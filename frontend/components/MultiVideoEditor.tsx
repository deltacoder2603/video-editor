'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Video, 
  Plus, 
  Trash2, 
  Play, 
  Scissors, 
  Download,
  Clock,
  Layers,
  FileVideo
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Timeline from './Timeline';
import VideoPlayer from './VideoPlayer';
import { 
  VideoSegment, 
  multiVideoTrimJoin, 
  ProcessingProgress,
  formatDuration,
  formatFileSize
} from '@/lib/api';

interface VideoFile {
  id: string;
  originalName: string;
  filename: string;
  size: number;
  videoInfo: {
    duration: number;
    size: number;
    format: string;
    video: {
      resolution: string;
    };
  };
}

interface MultiVideoEditorProps {
  sessionId: string;
  videos: VideoFile[];
  onProcessComplete?: (result: { outputFile: string; downloadUrl: string; version: number }) => void;
  className?: string;
}

interface VideoSegmentState {
  videoId: string;
  segments: Array<{ id: string; start: number; end: number; type: 'trim' }>;
  currentTime: number;
}

export default function MultiVideoEditor({
  sessionId,
  videos,
  onProcessComplete,
  className
}: MultiVideoEditorProps) {
  const [videoSegments, setVideoSegments] = useState<VideoSegmentState[]>(
    videos.map(video => ({
      videoId: video.id,
      segments: [],
      currentTime: 0
    }))
  );
  const [outputName, setOutputName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [processingError, setProcessingError] = useState<string>('');

  // Ensure videoSegments is always in sync with videos
  useEffect(() => {
    setVideoSegments(prev => {
      // Add missing videoStates for new videos
      const updated = videos.map(video => {
        const existing = prev.find(vs => vs.videoId === video.id);
        return existing || { videoId: video.id, segments: [], currentTime: 0 };
      });
      return updated;
    });
  }, [videos]);

  const updateVideoSegments = useCallback((videoId: string, segments: any[]) => {
    setVideoSegments(prev => prev.map(vs => 
      vs.videoId === videoId 
        ? { ...vs, segments }
        : vs
    ));
  }, []);

  const updateCurrentTime = useCallback((videoId: string, time: number) => {
    setVideoSegments(prev => prev.map(vs => 
      vs.videoId === videoId 
        ? { ...vs, currentTime: time }
        : vs
    ));
  }, []);

  const addSegmentToVideo = (videoId: string) => {
    const videoState = videoSegments.find(vs => vs.videoId === videoId);
    const video = videos.find(v => v.id === videoId);
    
    if (!videoState || !video) return;

    const newSegment = {
      id: Date.now().toString(),
      start: Math.max(0, videoState.currentTime - 5),
      end: Math.min(video.videoInfo.duration, videoState.currentTime + 5),
      type: 'trim' as const
    };

    updateVideoSegments(videoId, [...videoState.segments, newSegment]);
  };

  const removeSegmentFromVideo = (videoId: string, segmentId: string) => {
    const videoState = videoSegments.find(vs => vs.videoId === videoId);
    if (!videoState) return;

    updateVideoSegments(
      videoId, 
      videoState.segments.filter(s => s.id !== segmentId)
    );
  };

  const handleProcess = async () => {
    if (!sessionId) {
      alert('No session ID available');
      return;
    }

    // Filter out videos with no segments
    const videosWithSegments = videoSegments.filter(vs => vs.segments.length > 0);
    
    if (videosWithSegments.length === 0) {
      alert('Please add at least one segment from any video');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');
    setProcessingProgress(null);

    try {
      // Convert to API format
      const apiVideoSegments: VideoSegment[] = videosWithSegments.map(vs => ({
        videoId: vs.videoId,
        segments: vs.segments.map(s => ({ start: s.start, end: s.end }))
      }));

      const result = await multiVideoTrimJoin(
        sessionId,
        apiVideoSegments,
        outputName || undefined,
        (progress) => {
          setProcessingProgress(progress);
        }
      );

      onProcessComplete?.({
        outputFile: result.outputFile,
        downloadUrl: result.downloadUrl,
        version: result.version || 1
      });
      
      // Clear segments after successful processing
      setVideoSegments(prev => prev.map(vs => ({ ...vs, segments: [] })));
      setOutputName('');
      
    } catch (error) {
      console.error('Multi-video processing error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const getTotalSegments = () => {
    return videoSegments.reduce((total, vs) => total + vs.segments.length, 0);
  };

  const getTotalDuration = () => {
    return videoSegments.reduce((total, vs) => {
      const segmentDuration = vs.segments.reduce((segTotal, segment) => 
        segTotal + (segment.end - segment.start), 0
      );
      return total + segmentDuration;
    }, 0);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Layers className="w-5 h-5" />
          <span>Multi-Video Editor</span>
          <Badge variant="outline">
            {videos.length} videos
          </Badge>
        </CardTitle>
        <CardDescription>
          Select segments from multiple videos to trim and join into a single output
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enhanced Video Player for Multi-Video */}
        {videos.length > 0 && (
          <VideoPlayer
            uploadResponse={videos[0] ? {
              success: true,
              file: {
                id: videos[0].id,
                originalName: videos[0].originalName,
                filename: videos[0].filename,
                size: videos[0].size,
                path: `/uploads/${videos[0].filename}`,
                uploadedAt: '' // or a valid date string if available
              },
              videoInfo: videos[0].videoInfo
            } : null}
            processedVideoUrl={undefined}
            className="your-classname-if-needed"
            onTimeUpdate={undefined}
            onDurationChange={undefined}
          />
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {videos.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Source Videos
            </div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {getTotalSegments()}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Segments
            </div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {formatTime(getTotalDuration())}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Output Duration
            </div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {formatFileSize(videos.reduce((sum, v) => sum + v.size, 0))}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Size
            </div>
          </div>
        </div>

        {/* Output Settings */}
        <div className="space-y-3">
          <Label htmlFor="output-name">Output Filename (optional)</Label>
          <Input
            id="output-name"
            placeholder="my_joined_video"
            value={outputName}
            onChange={(e) => setOutputName(e.target.value)}
          />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Leave empty for auto-generated name
          </p>
        </div>

        <Separator />

        {/* Video Editors */}
        <div className="space-y-6">
          {videos.map((video, index) => {
            let videoState = videoSegments.find(vs => vs.videoId === video.id);
            if (!videoState) {
              videoState = { videoId: video.id, segments: [], currentTime: 0 };
            }
            return (
              <Card key={video.id} className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileVideo className="w-4 h-4" />
                      <span>Video {index + 1}: {video.originalName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {video.videoInfo.video.resolution}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {formatDuration(video.videoInfo.duration)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {videoState.segments.length} segments
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Add Segment */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Current time: {formatTime(videoState.currentTime)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => addSegmentToVideo(video.id)}
                        size="sm"
                        variant="outline"
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Segment
                      </Button>
                      <Button
                        onClick={() => updateVideoSegments(video.id, [
                          ...videoState.segments,
                          { id: Date.now().toString(), start: 0, end: video.videoInfo.duration, type: 'trim' }
                        ])}
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                      >
                        Select Whole Video
                      </Button>
                    </div>
                  </div>
                  {/* Timeline */}
                  <Timeline
                    duration={video.videoInfo.duration}
                    currentTime={videoState.currentTime}
                    segments={videoState.segments}
                    onSegmentsChange={(segments) => updateVideoSegments(video.id, segments)}
                    onTimeSeek={(time) => updateCurrentTime(video.id, time)}
                    mode="trim"
                  />
                  {/* Segment List */}
                  {videoState.segments.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Segments for this video:</Label>
                      <div className="space-y-1">
                        {videoState.segments.map((segment, segIndex) => (
                          <div
                            key={segment.id}
                            className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border"
                          >
                            <div className="flex items-center space-x-2">
                              <Badge variant="outline" className="w-8 justify-center text-xs">
                                {segIndex + 1}
                              </Badge>
                              <span className="text-sm">
                                {formatTime(segment.start)} - {formatTime(segment.end)}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {formatTime(segment.end - segment.start)}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSegmentFromVideo(video.id, segment.id)}
                              className="text-red-500 hover:text-red-600 h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Processing Progress */}
        {(isProcessing || processingProgress) && (
          <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                    Processing Multi-Video Join
                  </h3>
                  <Badge variant="outline">
                    {processingProgress ? `${Math.round(processingProgress.progress * 100)}%` : '0%'}
                  </Badge>
                </div>
                <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress ? processingProgress.progress * 100 : 0}%` }}
                  />
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {processingProgress?.message || 'Initializing multi-video processing...'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {processingError && (
          <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className="text-red-600">⚠️</div>
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">Processing Error</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">{processingError}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Process Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {getTotalSegments() > 0 ? (
              <>Ready to join {getTotalSegments()} segments from {videoSegments.filter(vs => vs.segments.length > 0).length} videos</>
            ) : (
              'Add segments from videos to enable processing'
            )}
          </div>
          <Button
            onClick={handleProcess}
            disabled={isProcessing || getTotalSegments() === 0}
            className="gap-2"
            size="lg"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                Join Videos
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}