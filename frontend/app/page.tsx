'use client';

import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Download, 
  VolumeX, 
  Scissors, 
  Shield, 
  Video, 
  Wand2,
  Clock,
  Settings,
  Brain,
  FileText,
  Upload,
  Server
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import VideoPreview from '@/components/VideoPreview';
import Timeline from '@/components/Timeline';
import ProcessingProgress from '@/components/ProcessingProgress';
import ProfanitySettings, { ProfanitySettings as ProfanitySettingsType } from '@/components/ProfanitySettings';
import ProfanityReport from '@/components/ProfanityReport';

import { 
  UploadResponse, 
  ProcessingProgress as ProgressType,
  removeAudioFromSegments,
  trimVideo,
  muteProfanity,
  detectProfanity,
  downloadVideo,
  cleanupFiles
} from '@/lib/api';

interface TimelineSegment {
  id: string;
  start: number;
  end: number;
  type: 'audio-remove' | 'trim' | 'profanity';
}

interface ProfanitySegment {
  start: number;
  end: number;
  confidence: number;
  detectedWords?: string[];
  originalText?: string;
  method?: string;
}

export default function Home() {
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState('audio-remove');
  
  // Segments for different operations
  const [audioSegments, setAudioSegments] = useState<TimelineSegment[]>([]);
  const [trimSegments, setTrimSegments] = useState<TimelineSegment[]>([]);
  const [profanitySegments, setProfanitySegments] = useState<TimelineSegment[]>([]);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProgressType | null>(null);
  const [processingError, setProcessingError] = useState<string>('');
  
  // Profanity detection states
  const [profanityReport, setProfanityReport] = useState<ProfanitySegment[]>([]);
  const [showProfanityReport, setShowProfanityReport] = useState(false);
  const [useOriginalForEditing, setUseOriginalForEditing] = useState(true);
  
  // Settings
  const [joinTrimSegments, setJoinTrimSegments] = useState(false);
  const [autoDetectProfanity, setAutoDetectProfanity] = useState(true);
  const [profanitySettings, setProfanitySettings] = useState<ProfanitySettingsType>({
    useAI: false,
    useAllProfanity: true,
    apiKey: '',
    customWords: [],
    strictMode: false,
    confidenceThreshold: 0.7,
    languages: ['hindi', 'english']
  });

  const handleFileSelect = useCallback((response: UploadResponse) => {
    console.log('File uploaded:', response);
    setUploadResponse(response);
    setProcessedVideoUrl('');
    setAudioSegments([]);
    setTrimSegments([]);
    setProfanitySegments([]);
    setProfanityReport([]);
    setShowProfanityReport(false);
    setProcessingError('');
    setVideoDuration(response.videoInfo.duration);
    setCurrentTime(0);
    setUseOriginalForEditing(true);
  }, []);

  const handleTimeSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback((duration: number) => {
    console.log('Duration changed:', duration);
    setVideoDuration(duration);
  }, []);

  const handleProfanitySettingsChange = useCallback((settings: ProfanitySettingsType) => {
    setProfanitySettings(settings);
  }, []);

  const getActiveSegments = () => {
    switch (activeTab) {
      case 'audio-remove':
        return audioSegments;
      case 'trim':
        return trimSegments;
      case 'profanity':
        return profanitySegments;
      default:
        return [];
    }
  };

  const setActiveSegments = (segments: TimelineSegment[]) => {
    switch (activeTab) {
      case 'audio-remove':
        setAudioSegments(segments);
        break;
      case 'trim':
        setTrimSegments(segments);
        break;
      case 'profanity':
        setProfanitySegments(segments);
        break;
    }
  };

  const handleAutoDetectProfanity = async () => {
    if (!uploadResponse || !videoDuration) return;

    setIsProcessing(true);
    setProcessingError('');
    
    try {
      const detectionResult = await detectProfanity(
        uploadResponse.file.id,
        'hi', // Default to Hindi as per backend
        (progress) => {
          setProcessingProgress(progress);
        }
      );

      const segments: TimelineSegment[] = detectionResult.segments.map((segment, index) => ({
        id: `profanity-${Date.now()}-${index}`,
        start: segment.start,
        end: segment.end,
        type: 'profanity' as const
      }));

      // Create detailed profanity report
      const reportSegments: ProfanitySegment[] = detectionResult.segments.map((segment, index) => ({
        start: segment.start,
        end: segment.end,
        confidence: 0.85, // Backend doesn't return confidence, using default
        detectedWords: ['detected'], // Backend doesn't return specific words
        originalText: `Detected profanity segment ${index + 1}`,
        method: 'backend'
      }));

      setProfanitySegments(segments);
      setProfanityReport(reportSegments);
      setShowProfanityReport(true);
      
      setProcessingProgress({
        phase: 'Complete',
        progress: 1,
        message: `Detected ${segments.length} profane segments using backend analysis`
      });
      
      setTimeout(() => {
        setProcessingProgress(null);
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      setProcessingError('Failed to analyze audio for profanity');
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  const handleProcess = async () => {
    if (!uploadResponse) return;

    const segments = getActiveSegments();
    if (segments.length === 0) {
      alert('Please add at least one segment to process.');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');
    setProcessedVideoUrl('');

    try {
      let result;
      const fileId = uploadResponse.file.id;
      const segmentData = segments.map(s => ({ start: s.start, end: s.end }));

      switch (activeTab) {
        case 'audio-remove':
          result = await removeAudioFromSegments(fileId, segmentData, setProcessingProgress);
          break;
        case 'trim':
          result = await trimVideo(fileId, segmentData, joinTrimSegments, setProcessingProgress);
          break;
        case 'profanity':
          result = await muteProfanity(fileId, segmentData, 'hi', setProcessingProgress);
          break;
        default:
          throw new Error('Invalid processing mode');
      }

      // Set the processed video URL
      setProcessedVideoUrl(`http://localhost:3001${result.downloadUrl}`);
      
    } catch (error) {
      console.error('Processing error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (processedVideoUrl) {
      const filename = processedVideoUrl.split('/').pop() || 'processed_video.mp4';
      downloadVideo(filename);
    }
  };

  const handleContinueWithOriginal = () => {
    setUseOriginalForEditing(true);
    setShowProfanityReport(false);
    setActiveTab('audio-remove');
  };

  const handleContinueWithProcessed = () => {
    setUseOriginalForEditing(false);
    setShowProfanityReport(false);
    setActiveTab('audio-remove');
  };

  const handleCleanup = async () => {
    if (uploadResponse) {
      try {
        await cleanupFiles(uploadResponse.file.id);
        console.log('Files cleaned up successfully');
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'audio-remove':
        return <VolumeX className="w-4 h-4" />;
      case 'trim':
        return <Scissors className="w-4 h-4" />;
      case 'profanity':
        return <Shield className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'audio-remove':
        return 'Remove audio from specific time segments while keeping the whole video';
      case 'trim':
        return 'Trim video segments and optionally join them';
      case 'profanity':
        return 'Detect and mute inappropriate language using backend processing';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <div className="p-3 bg-blue-600 rounded-2xl">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Advanced Video Processor
            </h1>
            <div className="p-2 bg-green-600 rounded-lg">
              <Server className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Professional video editing powered by Express.js backend with FFmpeg. Remove audio, trim segments, and filter content with multilingual profanity detection. Supports up to 50GB files.
          </p>
          <div className="flex items-center justify-center space-x-2 text-sm text-green-600 dark:text-green-400">
            <Server className="w-4 h-4" />
            <span>Backend Processing • Whisper Transcription • Multilingual Support</span>
          </div>
        </div>

        {/* Upload Section */}
        <Card className="border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Video Upload</span>
              <Badge variant="outline" className="gap-1">
                <Server className="w-3 h-3" />
                Backend
              </Badge>
            </CardTitle>
            <CardDescription>
              Upload your video for server-side processing with FFmpeg
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FileUpload onFileSelect={handleFileSelect} maxSize={50 * 1024 * 1024 * 1024} />
            {uploadResponse && (
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-center justify-center space-x-2 text-sm text-green-600 dark:text-green-400 mb-2">
                  <Video className="w-4 h-4" />
                  <span>Uploaded: {uploadResponse.file.originalName}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div>Size: {(uploadResponse.file.size / (1024 * 1024)).toFixed(1)} MB</div>
                  <div>Duration: {Math.floor(uploadResponse.videoInfo.duration / 60)}:{(uploadResponse.videoInfo.duration % 60).toFixed(0).padStart(2, '0')}</div>
                  <div>Resolution: {uploadResponse.videoInfo.video.resolution}</div>
                  <div>Format: {uploadResponse.videoInfo.format}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processing Progress */}
        {(isProcessing || processingProgress) && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center space-x-2">
                    <Server className="w-5 h-5 text-green-500" />
                    <span>Backend Processing</span>
                  </h3>
                  <Badge variant="outline">
                    {processingProgress ? `${Math.round(processingProgress.progress * 100)}%` : '0%'}
                  </Badge>
                </div>
                <Progress 
                  value={processingProgress ? processingProgress.progress * 100 : 0} 
                  className="h-3"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {processingProgress?.message || 'Initializing backend processing...'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profanity Detection Report */}
        {showProfanityReport && (
          <ProfanityReport
            segments={profanityReport}
            totalDuration={videoDuration}
            detectionMethod="Backend Whisper + Multilingual Filter"
            onContinueWithOriginal={handleContinueWithOriginal}
            onContinueWithProcessed={handleContinueWithProcessed}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl"
          />
        )}

        {uploadResponse && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Video Preview */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Video className="w-5 h-5" />
                  <span>Video Preview</span>
                  {processedVideoUrl && (
                    <Badge className="bg-green-100 text-green-800">Processed</Badge>
                  )}
                  <Badge className="bg-blue-100 text-blue-800 gap-1">
                    <Server className="w-3 h-3" />
                    Backend
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VideoPreview
                  uploadResponse={uploadResponse}
                  processedVideoUrl={processedVideoUrl}
                  onTimeUpdate={handleTimeSeek}
                  onDurationChange={handleDurationChange}
                />
                {processedVideoUrl && (
                  <div className="mt-4 space-y-2">
                    <Button onClick={handleDownload} className="w-full gap-2">
                      <Download className="w-4 h-4" />
                      Download Processed Video
                    </Button>
                    <Button onClick={handleCleanup} variant="outline" className="w-full gap-2">
                      <FileText className="w-4 h-4" />
                      Clean Up Files
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Processing Controls */}
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wand2 className="w-5 h-5" />
                  <span>Processing Tools</span>
                  <Badge variant="outline" className="gap-1">
                    <Server className="w-3 h-3" />
                    Server-side
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Select segments and apply video processing operations using backend FFmpeg
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="audio-remove" className="gap-2">
                      {getTabIcon('audio-remove')}
                      Audio
                    </TabsTrigger>
                    <TabsTrigger value="trim" className="gap-2">
                      {getTabIcon('trim')}
                      Trim
                    </TabsTrigger>
                    <TabsTrigger value="profanity" className="gap-2">
                      {getTabIcon('profanity')}
                      Filter
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="audio-remove" className="space-y-4">
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Audio Removal</h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {getTabDescription('audio-remove')}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="trim" className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Video Trimming</h3>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        {getTabDescription('trim')}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="join-segments"
                          checked={joinTrimSegments}
                          onCheckedChange={setJoinTrimSegments}
                        />
                        <Label htmlFor="join-segments" className="text-sm">
                          Join multiple segments
                        </Label>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="profanity" className="space-y-4">
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                      <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2 flex items-center space-x-2">
                        <Brain className="w-4 h-4" />
                        <span>Backend Profanity Filtering</span>
                      </h3>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mb-3">
                        Uses Whisper for transcription and multilingual profanity detection
                      </p>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="auto-detect"
                            checked={autoDetectProfanity}
                            onCheckedChange={setAutoDetectProfanity}
                          />
                          <Label htmlFor="auto-detect" className="text-sm">
                            Enable automatic detection
                          </Label>
                        </div>
                        {autoDetectProfanity && (
                          <Button
                            onClick={handleAutoDetectProfanity}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={isProcessing || !videoDuration}
                          >
                            <Server className="w-4 h-4" />
                            Backend Detection (Whisper + Filter)
                          </Button>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <Separator />

                {/* Processing Controls */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Settings className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">Process Video</span>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      {getActiveSegments().length} segments
                    </Badge>
                  </div>

                  <Button
                    onClick={handleProcess}
                    disabled={isProcessing || getActiveSegments().length === 0 || !videoDuration}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing on Server...
                      </>
                    ) : (
                      <>
                        <Server className="w-4 h-4" />
                        Process Video (Backend)
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Profanity Settings */}
        {uploadResponse && activeTab === 'profanity' && (
          <ProfanitySettings
            onSettingsChange={handleProfanitySettingsChange}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl"
          />
        )}

        {/* Timeline */}
        {uploadResponse && videoDuration > 0 && !showProfanityReport && (
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Timeline Editor</span>
              </CardTitle>
              <CardDescription>
                Add and edit segments for {activeTab.replace('-', ' ')} operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline
                duration={videoDuration}
                currentTime={currentTime}
                segments={getActiveSegments()}
                onSegmentsChange={setActiveSegments}
                onTimeSeek={handleTimeSeek}
                mode={activeTab as 'audio-remove' | 'trim' | 'profanity'}
              />
            </CardContent>
          </Card>
        )}

        {/* Processing Progress */}
        {processingError && (
          <ProcessingProgress
            progress={null}
            isProcessing={false}
            error={processingError}
          />
        )}
      </div>
    </div>
  );
}