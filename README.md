# Video Feedback Recorder

A browser-based prototype that allows users to record audio feedback while watching a video. The application captures audio, tracks video playhead positions, transcribes the audio using OpenAI's Whisper API, and generates a summary with timestamps using GPT-4o.

## Features

- Embedded video player with full controls (pause, rewind, seek)
- Audio recording synchronized with video playback
- Tracking of video playhead positions during recording
- Audio transcription using OpenAI's Whisper API
- Transcript alignment with video timestamps
- Summary generation using OpenAI's GPT-4o API
- Interactive summary with clickable timestamps

## Technology Stack

- **Frontend**: React with TypeScript (Vite)
- **Backend**: Node.js with Express
- **APIs**: OpenAI Whisper and GPT-4o

## Prerequisites

- Node.js (v14+)
- NPM or Yarn
- OpenAI API key

## Setup

### Backend

1. Navigate to the backend directory:
   ```
   cd audio_input/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key
   PORT=3001
   ```

4. Start the backend server:
   ```
   npm run dev
   ```

### Frontend

1. Navigate to the frontend directory:
   ```
   cd audio_input/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and go to `http://localhost:5173`

## Usage

1. Load the application in your browser
2. Click the "Record" button to start recording your feedback
3. Watch the video, providing verbal feedback as you go
4. Use video controls as needed (pause, rewind, seek)
5. Click "Stop" when finished
6. Wait for processing (transcription and summarization)
7. View the summary and full transcript with clickable timestamps

## Development Notes

- The backend server must be running for the frontend to work correctly
- Audio is temporarily stored on the server during processing but is deleted afterward
- Make sure your browser has permission to access your microphone
- The sample video can be changed by modifying the `SAMPLE_VIDEO_URL` constant in `App.tsx`

## Environment Variables

### Backend

- `OPENAI_API_KEY`: Your OpenAI API key
- `PORT`: Port for the backend server (default: 3001)

## License

MIT