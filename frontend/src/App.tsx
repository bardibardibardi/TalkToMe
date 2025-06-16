import { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import './App.css';

// Sample video URL - replace with your actual video URL
const SAMPLE_VIDEO_URL = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const API_URL = import.meta.env.PROD 
  ? '/api/process' 
  : 'http://localhost:3001/api/process';

interface PlayheadLog {
  recordingTime: number;
  videoTime: number;
}

interface TranscriptSegment {
  videoTime: number;
  text: string;
  start: number;
  end: number;
}

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [processingFeedback, setProcessingFeedback] = useState(false);
  const [playheadLog, setPlayheadLog] = useState<PlayheadLog[]>([]);
  const [alignedTranscript, setAlignedTranscript] = useState<TranscriptSegment[]>([]);
  const [summary, setSummary] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try different formats in order of preference
      const formats = [
        'audio/wav',
        'audio/mp4', 
        'audio/webm;codecs=pcm',
        'audio/webm'
      ];
      
      let mediaRecorder;
      let selectedFormat = 'audio/webm'; // fallback
      
      for (const format of formats) {
        if (MediaRecorder.isTypeSupported(format)) {
          selectedFormat = format;
          break;
        }
      }
      
      console.log('Using audio format:', selectedFormat);
      mediaRecorder = new MediaRecorder(stream, { mimeType: selectedFormat });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      setPlayheadLog([]);
      
      // Start playing the video when recording begins
      if (videoRef.current) {
        videoRef.current.play();
      }
      
      // Start logging video playhead position
      intervalRef.current = window.setInterval(() => {
        if (videoRef.current) {
          const newLog: PlayheadLog = {
            recordingTime: Date.now() - (startTimeRef.current || 0),
            videoTime: videoRef.current.currentTime
          };
          setPlayheadLog(prev => [...prev, newLog]);
        }
      }, 250);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please ensure microphone permissions are granted.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Pause the video when recording stops
      if (videoRef.current) {
        videoRef.current.pause();
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          setProcessingFeedback(true);
          
          const audioBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' });
          
          // Send audio and playhead log to backend
          const formData = new FormData();
          const extension = audioBlob.type.includes('mp4') ? '.mp4' : 
                           audioBlob.type.includes('wav') ? '.wav' : '.webm';
          formData.append('audio', audioBlob, `recording${extension}`);
          formData.append('playheadLog', JSON.stringify(playheadLog));
          
          try {
            const response = await fetch(API_URL, {
              method: 'POST',
              body: formData,
            });
            
            if (response.ok) {
              const data = await response.json();
              setAlignedTranscript(data.alignedTranscript);
              setSummary(data.summary);
            } else {
              console.error('Error processing feedback');
              alert('Error processing feedback. Please try again.');
            }
          } catch (error) {
            console.error('Error sending recording to server:', error);
            alert('Error sending recording to server. Please try again.');
          } finally {
            setProcessingFeedback(false);
          }
        }
        
        setIsRecording(false);
      };
    }
  };
  
  const seekVideo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="app-container">
      <div className="main-layout">
        <div className="left-panel">
          <div className="video-container">
            <video 
              ref={videoRef}
              src={SAMPLE_VIDEO_URL}
              controls
              style={{
                width: '100%',
                height: 'auto',
                aspectRatio: '16/9'
              }}
            />
          </div>
          
          <div className="controls">
            {!isRecording ? (
              <button 
                className="record-button"
                onClick={startRecording}
                disabled={processingFeedback}
              >
                Record
              </button>
            ) : (
              <button 
                className="stop-button"
                onClick={stopRecording}
              >
                Stop
              </button>
            )}
            
            {isRecording && (
              <div className="recording-indicator">
                Recording... {playheadLog.length > 0 && `(${playheadLog.length} timestamps logged)`}
              </div>
            )}
            
            {processingFeedback && (
              <div className="processing-indicator">
                Processing feedback...
              </div>
            )}
          </div>
        </div>

        <div className="right-panel">
          {summary && (
            <div className="results-container">
              <h2>Feedback Summary</h2>
              <div 
                className="summary" 
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.classList.contains('timestamp-link')) {
                    e.preventDefault();
                    const timeStr = target.getAttribute('data-time');
                    if (timeStr) {
                      const timeInSeconds = parseFloat(timeStr);
                      seekVideo(timeInSeconds);
                    }
                  }
                }}
                dangerouslySetInnerHTML={{ 
                  __html: (() => {
                    const markedResult = marked(summary);
                    const htmlString = typeof markedResult === 'string' ? markedResult : '';
                    return htmlString.replace(/<a href="[^"]*(\d{2}:\d{2})[^"]*">([^<]+)<\/a>/g, (_match: string, timestamp: string, _display: string) => {
                      // Extract timestamp and convert to seconds
                      const [minutes, seconds] = timestamp.split(':').map(Number);
                      const totalSeconds = minutes * 60 + seconds;
                      
                      return `<a href="javascript:void(0)" data-time="${totalSeconds}" class="timestamp-link">[${timestamp}]</a>`;
                    });
                  })()
                }} 
              />
              
              <h2>Full Transcript</h2>
              <div className="transcript">
                {alignedTranscript.map((segment, index) => (
                  <div key={index} className="transcript-segment">
                    <a 
                      href="#" 
                      className="timestamp-link"
                      onClick={(e) => {
                        e.preventDefault();
                        seekVideo(segment.videoTime);
                      }}
                    >
                      [{formatTime(segment.videoTime)}]
                    </a>
                    <span className="transcript-text">{segment.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Add event listener to make timestamp links clickable
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.classList.contains('timestamp-link')) {
    e.preventDefault();
    const timeStr = target.getAttribute('data-time');
    if (timeStr) {
      const timeInSeconds = parseFloat(timeStr);
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.currentTime = timeInSeconds;
        videoElement.play();
      }
    }
  }
});

export default App;