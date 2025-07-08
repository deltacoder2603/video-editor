'use client';

import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { UploadResponse, MultiUploadResponse, downloadVideo, formatFileSize, formatDuration } from '@/lib/api';

interface VideoPlayerProps {
  uploadResponse: UploadResponse | MultiUploadResponse | null;
  processedVideoUrl?: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onDurationChange?: (duration: number) => void;
}

function isMultiUploadResponse(
  resp: UploadResponse | MultiUploadResponse | null
): resp is MultiUploadResponse {
  return !!resp && Array.isArray((resp as MultiUploadResponse).files);
}

export default function VideoPlayer({ 
  uploadResponse, 
  processedVideoUrl,
  className,
  onTimeUpdate,
  onDurationChange
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [videoError, setVideoError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Get video URL - use processed video if available, otherwise original
  let videoUrl: string | undefined = processedVideoUrl;
  if (!videoUrl && uploadResponse) {
    if (!isMultiUploadResponse(uploadResponse) && uploadResponse.file && uploadResponse.file.filename) {
      videoUrl = `http://localhost:3001/uploads/${uploadResponse.file.filename}`;
    } else if (isMultiUploadResponse(uploadResponse) && uploadResponse.files.length > 0 && uploadResponse.files[0].filename) {
      videoUrl = `http://localhost:3001/uploads/${uploadResponse.files[0].filename}`;
    }
  }

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    };

    const handleLoadedMetadata = () => {
      const dur = video.duration;
      if (dur && !isNaN(dur) && isFinite(dur)) {
        setDuration(dur);
        onDurationChange?.(dur);
        setIsLoading(false);
        setVideoError('');
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      setVideoError('');
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLVideoElement;
      let errorMessage = 'Unknown video error';
      if (target && target.error) {
        switch (target.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video loading was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video format not supported or corrupted';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video format not supported by browser';
            break;
          default:
            errorMessage = `Video error (code: ${target.error.code})`;
        }
      }
      setVideoError(errorMessage);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setVideoError('');
    };

    // Add event listeners
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, [videoUrl, onTimeUpdate, onDurationChange]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video || videoError) return;
    try {
      if (isPlaying) {
        video.pause();
        setIsPlaying(false);
      } else {
        await video.play();
        setIsPlaying(true);
      }
    } catch (error) {
      setVideoError('Failed to play video');
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || !duration || videoError) return;
    const time = value[0];
    video.currentTime = time;
    setCurrentTime(time);
    onTimeUpdate?.(time);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = value[0];
    video.volume = vol;
    setVolume(vol);
    if (vol === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (!video || videoError) return;
    if (video.requestFullscreen) {
      video.requestFullscreen();
      }
    };

  const resetVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setCurrentTime(0);
    onTimeUpdate?.(0);
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    }
    setVideoError('');
  };

  const handleDownload = () => {
    if (processedVideoUrl) {
      const filename = processedVideoUrl.split('/').pop() || 'processed_video.mp4';
      downloadVideo(filename);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!videoUrl) {
    return (
      <div className={cn(
        'aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center',
        className
      )}>
        <p className="text-gray-500 dark:text-gray-400">No video selected</p>
      </div>
    );
  }

  return (
    <div className={cn('relative bg-black rounded-xl overflow-hidden shadow-2xl', className)}>
      {/* Video Info Display */}
      {uploadResponse && (
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded-lg text-xs z-10">
          <div className="flex items-center space-x-2">
            <Badge className="bg-blue-500 text-white text-xs">
              {(!isMultiUploadResponse(uploadResponse)
                ? uploadResponse.videoInfo?.video.resolution
                : uploadResponse.files[0]?.videoInfo?.video.resolution) || '--'}
            </Badge>
            <span>{formatFileSize(
              !isMultiUploadResponse(uploadResponse)
                ? uploadResponse.file?.size || 0
                : uploadResponse.files[0]?.size || 0
            )}</span>
            <span>{formatDuration(
              !isMultiUploadResponse(uploadResponse)
                ? uploadResponse.videoInfo?.duration || 0
                : uploadResponse.files[0]?.videoInfo?.duration || 0
            )}</span>
          </div>
        </div>
      )}

      {videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-contain"
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          style={{ maxHeight: '70vh' }}
        />
      )}
      
      {/* Loading Indicator */}
      {isLoading && !videoError && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="flex items-center space-x-2 text-white">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Loading video...</span>
          </div>
        </div>
      )}

      {/* Error Display */}
      {videoError && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-center text-white p-6">
            <div className="text-red-400 mb-2">⚠️ Video Error</div>
            <div className="text-sm mb-4">{videoError}</div>
            <Button
              onClick={resetVideo}
              variant="outline"
              size="sm"
              className="text-white border-white hover:bg-white hover:text-black"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}
      
      {/* Video Controls Overlay */}
      {!videoError && videoUrl && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
          {/* Progress Bar */}
          <div className="mb-3">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
              disabled={!duration || !!videoError}
            />
            <div className="flex justify-between text-xs text-white/80 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlay}
                className="text-white hover:text-white hover:bg-white/20"
                disabled={!duration || !!videoError}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={resetVideo}
                className="text-white hover:text-white hover:bg-white/20"
                disabled={!duration}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>

              <div className="flex items-center space-x-2 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="text-white hover:text-white hover:bg-white/20"
                  disabled={!duration || !!videoError}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                  disabled={!duration || !!videoError}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {processedVideoUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white hover:text-white hover:bg-white/20"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreen}
                className="text-white hover:text-white hover:bg-white/20"
                disabled={!duration || !!videoError}
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {processedVideoUrl && (
        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          Processed
        </div>
      )}
    </div>
  );
} 