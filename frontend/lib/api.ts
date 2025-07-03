// Enhanced API client for the updated Express.js backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface VideoInfo {
  duration: number;
  size: number;
  format: string;
  video: {
    codec: string;
    resolution: string;
    fps: string;
    bitrate: number;
  };
  audio: {
    codec: string;
    channels: number;
    sampleRate: number;
  };
}

export interface UploadResponse {
  success: boolean;
  file: {
    id: string;
    originalName: string;
    filename: string;
    size: number;
    path: string;
    uploadedAt: string;
  };
  videoInfo: VideoInfo;
}

export interface MultiUploadResponse {
  success: boolean;
  files: Array<{
    id: string;
    originalName: string;
    filename: string;
    size: number;
    path: string;
    uploadedAt: string;
    videoInfo: VideoInfo;
  }>;
  sessionId: string;
}

export interface SessionResponse {
  success: boolean;
  sessionId: string;
}

export interface TranscriptEntry {
  index: number;
  start: number;
  end: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
  }>;
}

export interface HighlightedWord {
  word: string;
  index: number;
  isProfane: boolean;
  detectedBy?: 'filter' | 'list';
}

export interface ProfanitySegment {
  start: number;
  end: number;
  text: string;
  highlightedWords: HighlightedWord[];
  index: number;
}

export interface ProfanityDetectionResponse {
  success: boolean;
  transcript: TranscriptEntry[];
  profanityData: {
    segments: ProfanitySegment[];
    detectedWords: Array<{
      word: string;
      timestamp: string;
      sentence: string;
    }>;
  };
  totalSegments: number;
}

export interface EditHistoryEntry {
  version: number;
  type: 'profanity_filter' | 'audio_removal' | 'trim' | 'multi_trim_join';
  filename: string;
  sourceVersion: string;
  timestamp: string;
  segmentsMuted?: number;
  selectedWords?: string[];
  segments?: Array<{ start: number; end: number }>;
  joinSegments?: boolean;
  videoSegments?: Array<{
    videoId: string;
    segments: Array<{ start: number; end: number }>;
  }>;
}

export interface SessionHistoryResponse {
  success: boolean;
  session: {
    id: string;
    videos: Array<{
      id: string;
      originalName: string;
      filename: string;
      size: number;
      path: string;
      uploadedAt: string;
    }>;
    createdAt: string;
    currentVersion: number;
  };
  history: EditHistoryEntry[];
  availableVersions: string[];
}

export interface ProcessResponse {
  success: boolean;
  outputFile: string;
  downloadUrl: string;
  version?: number;
  segmentsMuted?: number;
}

export interface ProcessingProgress {
  phase: string;
  progress: number;
  message: string;
}

export interface VideoSegment {
  videoId: string;
  segments: Array<{ start: number; end: number }>;
}

// Create a new session
export const createSession = async (): Promise<SessionResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }
};

// Upload multiple videos
export const uploadMultipleVideos = async (
  files: File[],
  sessionId: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<MultiUploadResponse> => {
  const formData = new FormData();
  files.forEach(file => formData.append('videos', file));
  formData.append('sessionId', sessionId);

  if (onProgress) {
    onProgress({
      phase: 'Uploading',
      progress: 0.1,
      message: `Uploading ${files.length} videos...`
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload-multiple`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Multi-upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: `Successfully uploaded ${files.length} videos!`
      });
    }

    return result;
  } catch (error) {
    console.error('Multi-upload error:', error);
    throw error;
  }
};

// Upload single video
export const uploadVideo = async (
  file: File,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('video', file);

  if (onProgress) {
    onProgress({
      phase: 'Uploading',
      progress: 0.1,
      message: 'Starting file upload...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: 'Upload completed successfully!'
      });
    }

    return result;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// Get transcript
export const getTranscript = async (
  fileId: string,
  language: string = 'hi',
  onProgress?: (progress: ProcessingProgress) => void
): Promise<{ success: boolean; transcript: TranscriptEntry[] }> => {
  if (onProgress) {
    onProgress({
      phase: 'Transcribing',
      progress: 0.1,
      message: 'Starting transcription...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, language }),
    });

    if (!response.ok) {
      throw new Error(`Transcription failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: `Transcription completed! Found ${result.transcript.length} segments`
      });
    }

    return result;
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
};

// Detect profanity with transcript
export const detectProfanity = async (
  fileId: string,
  language: string = 'hi',
  customWords: string[] = [],
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProfanityDetectionResponse> => {
  if (onProgress) {
    onProgress({
      phase: 'Analyzing',
      progress: 0.1,
      message: 'Starting profanity detection...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/detect-profanity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, language, customWords }),
    });

    if (!response.ok) {
      throw new Error(`Profanity detection failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: `Found ${result.totalSegments} profane segments`
      });
    }

    return result;
  } catch (error) {
    console.error('Profanity detection error:', error);
    throw error;
  }
};

// Add custom profanity words
export const addCustomProfanityWords = async (words: string[]): Promise<{ success: boolean; totalCustomWords: number }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/custom-profanity/add`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ words }),
    });

    if (!response.ok) {
      throw new Error(`Adding custom words failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Add custom words error:', error);
    throw error;
  }
};

// Get custom profanity words
export const getCustomProfanityWords = async (): Promise<{ success: boolean; words: string[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/custom-profanity`);

    if (!response.ok) {
      throw new Error(`Getting custom words failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Get custom words error:', error);
    throw error;
  }
};

// Get session history
export const getSessionHistory = async (sessionId: string): Promise<SessionHistoryResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}/history`);

    if (!response.ok) {
      throw new Error(`Getting session history failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Session history error:', error);
    throw error;
  }
};

// Process video - remove audio from segments
export const removeAudioFromSegments = async (
  fileId: string,
  segments: Array<{ start: number; end: number }>,
  sessionId: string,
  sourceVersion: string = 'original',
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessResponse> => {
  if (onProgress) {
    onProgress({
      phase: 'Processing',
      progress: 0.1,
      message: 'Starting audio removal...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/process/audio-remove`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, segments, sessionId, sourceVersion }),
    });

    if (!response.ok) {
      throw new Error(`Audio removal failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: 'Audio removal completed!'
      });
    }

    return result;
  } catch (error) {
    console.error('Audio removal error:', error);
    throw error;
  }
};

// Process video - trim segments
export const trimVideo = async (
  fileId: string,
  segments: Array<{ start: number; end: number }>,
  joinSegments: boolean = false,
  sessionId: string,
  sourceVersion: string = 'original',
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessResponse> => {
  if (onProgress) {
    onProgress({
      phase: 'Processing',
      progress: 0.1,
      message: 'Starting video trimming...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/process/trim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, segments, joinSegments, sessionId, sourceVersion }),
    });

    if (!response.ok) {
      throw new Error(`Video trimming failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: 'Video trimming completed!'
      });
    }

    return result;
  } catch (error) {
    console.error('Video trimming error:', error);
    throw error;
  }
};

// Process video - mute profanity (using backend profanity endpoint)
export const muteProfanity = async (
  fileId: string,
  segments: Array<{ start: number; end: number }> = [],
  language: string = 'hi',
  selectedWords: string[] = [],
  sessionId: string,
  sourceVersion: string = 'original',
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessResponse> => {
  if (onProgress) {
    onProgress({
      phase: 'Processing',
      progress: 0.1,
      message: 'Starting profanity filtering...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/process/profanity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, segments, language, selectedWords, sessionId, sourceVersion }),
    });

    if (!response.ok) {
      throw new Error(`Profanity filtering failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: `Profanity filtering completed! ${result.segmentsMuted || 0} segments muted`
      });
    }

    return result;
  } catch (error) {
    console.error('Profanity filtering error:', error);
    throw error;
  }
};

// Process multi-video trim and join
export const multiVideoTrimJoin = async (
  sessionId: string,
  videoSegments: VideoSegment[],
  outputName?: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<ProcessResponse> => {
  if (onProgress) {
    onProgress({
      phase: 'Processing',
      progress: 0.1,
      message: 'Starting multi-video processing...'
    });
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/process/multi-trim-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, videoSegments, outputName }),
    });

    if (!response.ok) {
      throw new Error(`Multi-video processing failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: 'Multi-video processing completed!'
      });
    }

    return result;
  } catch (error) {
    console.error('Multi-video processing error:', error);
    throw error;
  }
};

// Download processed video
export const downloadVideo = (filename: string): void => {
  const downloadUrl = `${API_BASE_URL}/api/download/${filename}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Clean up session
export const cleanupSession = async (sessionId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/session/${sessionId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Session cleanup failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Session cleanup error:', error);
    throw error;
  }
};

// Get video preview URL
export const getVideoPreviewUrl = (filename: string): string => {
  return `${API_BASE_URL}/uploads/${filename}`;
};

// Get processed video URL
export const getProcessedVideoUrl = (filename: string): string => {
  return `${API_BASE_URL}/api/download/${filename}`;
};

// Utility function to format file size
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Utility function to format duration
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};