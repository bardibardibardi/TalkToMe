const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// For production deployment
if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: process.env.FRONTEND_URL || 'https://your-app.vercel.app',
    credentials: true
  }));
} else {
  app.use(cors());
}
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function mapAudioToVideo(audioTime, playheadLog) {
  let closest = playheadLog.reduce((prev, curr) => {
    return Math.abs(curr.recordingTime/1000 - audioTime) < Math.abs(prev.recordingTime/1000 - audioTime) ? curr : prev;
  });
  return closest.videoTime;
}

app.post('/api/process', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get the playhead log from the request body
    const playheadLog = JSON.parse(req.body.playheadLog);
    console.log('Playhead log received:', playheadLog);
    console.log('Number of timestamps:', playheadLog.length);
    if (!playheadLog || !Array.isArray(playheadLog)) {
      return res.status(400).json({ error: 'Invalid playhead log' });
    }

    // Try transcribing WebM directly with Whisper
    const audioFilePath = req.file.path;
    console.log('Processing audio file:', audioFilePath);
    console.log('File size:', fs.statSync(audioFilePath).size, 'bytes');
    
    // Try direct HTTP request to OpenAI API
    console.log('Attempting direct HTTP request to OpenAI...');
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath));
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
    
    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...formData.getHeaders()
      },
      timeout: 30000 // 30 second timeout
    });
    
    const transcriptionResponse = response.data;

    // Map audio timestamps to video timestamps
    const alignedTranscript = transcriptionResponse.segments.map(segment => {
      const videoStartTime = mapAudioToVideo(segment.start, playheadLog);
      return {
        videoTime: videoStartTime,
        text: segment.text,
        start: segment.start,
        end: segment.end
      };
    });

    // Format transcript for GPT-4o prompt
    const formattedTranscript = alignedTranscript.map(segment => {
      return `[${formatTimestamp(segment.videoTime)}] ${segment.text}`;
    }).join("\\n");

    // Generate summary using GPT-4o
    const summaryResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are analyzing video feedback. The user gave verbal feedback while watching a video."
        },
        {
          role: "user",
          content: `Here is the transcript with video timestamps (in seconds):\n\n${formattedTranscript}\n\nFormat the feedback as follows:

## 📝 Summary
Brief overview of the main feedback themes.

## ✅ Action Items
Create a checklist of specific editorial tasks that can be acted upon. Each item should:
- Be a concrete action an editor can take
- Include the relevant timestamp as a clickable link [mm:ss](timestamp)
- Be formatted as: "- [ ] **Action description** at [mm:ss](timestamp)"

## 💬 Key Comments
- Organized bullet points of important feedback
- Include timestamps as clickable links [mm:ss](timestamp)

## 🎯 Overall Recommendations
High-level insights and suggestions for improvement.

Use clear markdown formatting with headers, bold text, and emoji for better scannability.`
        }
      ],
    });

    // Clean up the audio file
    fs.unlinkSync(audioFilePath);

    // Return both the aligned transcript and the summary
    res.json({
      alignedTranscript,
      summary: summaryResponse.choices[0].message.content
    });
  } catch (error) {
    console.error('Error processing feedback:', error);
    console.error('Error details:', error.message);
    
    if (error.status === 429) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and try again.' });
    } else {
      res.status(500).json({ error: 'Error processing feedback', details: error.message });
    }
  }
});

function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});