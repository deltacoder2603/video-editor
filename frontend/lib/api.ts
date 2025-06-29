// API client for Express.js backend
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

export interface ProcessResponse {
  success: boolean;
  outputFile: string;
  downloadUrl: string;
  segmentsMuted?: number;
}

export interface ProfanityDetectionResponse {
  success: boolean;
  segments: Array<{ start: number; end: number }>;
  profanityCount: number;
  totalDuration: number;
}

export interface ProcessingProgress {
  phase: string;
  progress: number;
  message: string;
}

// Upload video file to backend
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

// Detect profanity in video
export const detectProfanity = async (
  fileId: string,
  language: string = 'hi',
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
      body: JSON.stringify({ fileId, language }),
    });

    if (!response.ok) {
      throw new Error(`Profanity detection failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (onProgress) {
      onProgress({
        phase: 'Complete',
        progress: 1,
        message: `Found ${result.profanityCount} profane segments`
      });
    }

    return result;
  } catch (error) {
    console.error('Profanity detection error:', error);
    throw error;
  }
};

// Process video - remove audio from segments
export const removeAudioFromSegments = async (
  fileId: string,
  segments: Array<{ start: number; end: number }>,
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
      body: JSON.stringify({ fileId, segments }),
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
      body: JSON.stringify({ fileId, segments, joinSegments }),
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

// Process video - mute profanity
export const muteProfanity = async (
  fileId: string,
  segments?: Array<{ start: number; end: number }>,
  language: string = 'hi',
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
      body: JSON.stringify({ fileId, segments, language }),
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

// Clean up files
export const cleanupFiles = async (fileId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Cleanup failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
};

// Get video preview URL
export const getVideoPreviewUrl = (fileId: string): string => {
  return `${API_BASE_URL}/api/preview/${fileId}`;
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