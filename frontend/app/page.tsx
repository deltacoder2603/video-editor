'use client';

import { useState, useCallback, useEffect } from 'react';
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
  Server,
  Layers,
  History,
  Users
} from 'lucide-react';

import FileUpload from '@/components/FileUpload';
import MultiVideoUpload from '@/components/MultiVideoUpload';
import VideoPreview from '@/components/VideoPreview';
import VideoPlayer from '@/components/VideoPlayer';
import Timeline from '@/components/Timeline';
import ProcessingProgress from '@/components/ProcessingProgress';
import ProfanitySettings, { ProfanitySettings as ProfanitySettingsType } from '@/components/ProfanitySettings';
import ProfanityReport from '@/components/ProfanityReport';
import TranscriptViewer from '@/components/TranscriptViewer';
import VersionHistory from '@/components/VersionHistory';
import MultiVideoEditor from '@/components/MultiVideoEditor';

import { 
  UploadResponse, 
  MultiUploadResponse,
  ProcessingProgress as ProgressType,
  TranscriptEntry,
  ProfanitySegment,
  removeAudioFromSegments,
  trimVideo,
  muteProfanity,
  detectProfanity,
  getTranscript,
  downloadVideo,
  cleanupSession,
  createSession,
  getVideoPreviewUrl,
  getProcessedVideoUrl,
  addCustomProfanityWords
} from '@/lib/api';

interface TimelineSegment {
  id: string;
  start: number;
  end: number;
  type: 'audio-remove' | 'trim' | 'profanity';
}

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

export default function Home() {
  // Session Management
  const [sessionId, setSessionId] = useState<string>('');
  const [isMultiVideoMode, setIsMultiVideoMode] = useState(false);
  
  // Single Video State
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  
  // Multi Video State
  const [multiVideoResponse, setMultiVideoResponse] = useState<MultiUploadResponse | null>(null);
  const [videos, setVideos] = useState<VideoFile[]>([]);
  
  // Common State
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState('upload');
  const [selectedVersion, setSelectedVersion] = useState<string>('original');
  
  // Segments for different operations
  const [audioSegments, setAudioSegments] = useState<TimelineSegment[]>([]);
  const [trimSegments, setTrimSegments] = useState<TimelineSegment[]>([]);
  const [profanitySegments, setProfanitySegments] = useState<TimelineSegment[]>([]);
  
  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState<ProgressType | null>(null);
  const [processingError, setProcessingError] = useState<string>('');
  
  // Transcript and Profanity states
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [profanityData, setProfanityData] = useState<ProfanitySegment[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  
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

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const session = await createSession();
      setSessionId(session.sessionId);
      console.log('Session created:', session.sessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleFileSelect = useCallback((response: UploadResponse) => {
    console.log('Single file uploaded:', response);
    setUploadResponse(response);
    setMultiVideoResponse(null);
    setVideos([]);
    setIsMultiVideoMode(false);
    resetState();
    setVideoDuration(response.videoInfo.duration);
    setActiveTab('profanity'); // Go directly to profanity tab
  }, []);

  const handleMultiFileSelect = useCallback((response: MultiUploadResponse) => {
    console.log('Multiple files uploaded:', response);
    setMultiVideoResponse(response);
    setVideos(response.files);
    setUploadResponse(null);
    setIsMultiVideoMode(true);
    resetState();
    setActiveTab('multi-video');
  }, []);

  const resetState = () => {
    setProcessedVideoUrl('');
    setAudioSegments([]);
    setTrimSegments([]);
    setProfanitySegments([]);
    setTranscript([]);
    setProfanityData([]);
    setSelectedWords([]);
    setShowTranscript(false);
    setProcessingError('');
    setCurrentTime(0);
    setSelectedVersion('original');
  };

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

  const handleWordsSelected = useCallback((words: string[]) => {
    console.log('Words selected:', words);
    setSelectedWords(words);
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

  const getCurrentFileId = () => {
    if (isMultiVideoMode && videos.length > 0) {
      return videos[0].id; // Use first video for single operations
    }
    return uploadResponse?.file.id || '';
  };

  const getCurrentVideoUrl = () => {
    // If we have a processed video URL, use it
    if (processedVideoUrl) {
      return processedVideoUrl;
    }
    
    // For multi-video mode, return the first video
    if (isMultiVideoMode && videos.length > 0) {
      return getVideoPreviewUrl(videos[0].filename);
    }
    
    // For single video mode, return the original video
    if (uploadResponse) {
      // Handle both single and multi-upload response structures
      if (uploadResponse.file && uploadResponse.file.filename) {
        return getVideoPreviewUrl(uploadResponse.file.filename);
      }
      if (uploadResponse.files && uploadResponse.files.length > 0 && uploadResponse.files[0].filename) {
        return getVideoPreviewUrl(uploadResponse.files[0].filename);
      }
    }
    
    return '';
  };

  const handleGetTranscript = async () => {
    const fileId = getCurrentFileId();
    if (!fileId) return;

    setIsProcessing(true);
    setProcessingError('');
    
    try {
      const result = await detectProfanity(
        fileId,
        'hi',
        [],
        (progress) => {
          setProcessingProgress(progress);
        }
      );

      console.log('Profanity detection result:', result);
      setTranscript(result.transcript);
      setProfanityData(result.profanityData.segments);
      setShowTranscript(true);
      
      setProcessingProgress({
        phase: 'Complete',
        progress: 1,
        message: `Transcript ready with ${result.transcript.length} segments`
      });
      
      setTimeout(() => {
        setProcessingProgress(null);
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('Transcript error:', error);
      setProcessingError('Failed to get transcript');
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  const handleMuteAndProcess = async () => {
    const fileId = getCurrentFileId();
    if (!fileId || !sessionId) return;

    // Add selected words to backend custom list
    if (selectedWords.length > 0) {
      try {
        await addCustomProfanityWords(selectedWords);
        console.log('Added custom words to backend:', selectedWords);
      } catch (error) {
        console.error('Failed to add custom words:', error);
      }
    }

    setIsProcessing(true);
    setProcessingError('');
    setProcessedVideoUrl('');

    try {
      // Find all segments for selected words
      const segments = profanityData
        .filter(segment =>
          segment.highlightedWords.some(hw =>
            hw.isProfane && selectedWords.includes(hw.word.toLowerCase())
          )
        )
        .map(s => ({ start: s.start, end: s.end }));

      console.log('Segments to mute:', segments);

      const audioResult = await removeAudioFromSegments(
        fileId,
        segments,
        sessionId,
        selectedVersion,
        setProcessingProgress
      );

      setProcessedVideoUrl(getProcessedVideoUrl(audioResult.outputFile));

      setProcessingProgress({
        phase: 'Complete',
        progress: 1,
        message: `Successfully muted ${segments.length} segments`
      });

      setTimeout(() => {
        setProcessingProgress(null);
        setIsProcessing(false);
      }, 2000);

    } catch (error) {
      console.error('Muting error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Muting failed');
      setIsProcessing(false);
      setProcessingProgress(null);
    }
  };

  const handleProcess = async () => {
    const fileId = getCurrentFileId();
    if (!fileId || !sessionId) return;

    const segments = getActiveSegments();
    if (segments.length === 0 && activeTab !== 'profanity') {
      alert('Please add at least one segment to process.');
      return;
    }

    setIsProcessing(true);
    setProcessingError('');
    setProcessedVideoUrl('');

    try {
      let result;
      const segmentData = segments.map(s => ({ start: s.start, end: s.end }));

      switch (activeTab) {
        case 'audio-remove':
          result = await removeAudioFromSegments(
            fileId, 
            segmentData, 
            sessionId, 
            selectedVersion, 
            setProcessingProgress
          );
          break;
        case 'trim':
          result = await trimVideo(
            fileId, 
            segmentData, 
            joinTrimSegments, 
            sessionId, 
            selectedVersion, 
            setProcessingProgress
          );
          break;
        case 'profanity':
          result = await muteProfanity(
            fileId, 
            segmentData, 
            'hi', 
            selectedWords, 
            sessionId, 
            selectedVersion, 
            setProcessingProgress
          );
          break;
        default:
          throw new Error('Invalid processing mode');
      }

      setProcessedVideoUrl(getProcessedVideoUrl(result.outputFile));
      
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

  const handleCleanup = async () => {
    if (sessionId) {
      try {
        await cleanupSession(sessionId);
        console.log('Session cleaned up successfully');
        // Reinitialize session
        await initializeSession();
        resetState();
        setUploadResponse(null);
        setMultiVideoResponse(null);
        setVideos([]);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  };

  const handleMultiVideoProcessComplete = (result: any) => {
    setProcessedVideoUrl(getProcessedVideoUrl(result.outputFile));
    setActiveTab('processing');
  };

  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'upload':
        return <Upload className="w-4 h-4" />;
      case 'multi-video':
        return <Layers className="w-4 h-4" />;
      case 'processing':
        return <Wand2 className="w-4 h-4" />;
      case 'audio-remove':
        return <VolumeX className="w-4 h-4" />;
      case 'trim':
        return <Scissors className="w-4 h-4" />;
      case 'profanity':
        return <Shield className="w-4 h-4" />;
      case 'history':
        return <History className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTabDescription = (tab: string) => {
    switch (tab) {
      case 'upload':
        return 'Upload single video for processing';
      case 'multi-video':
        return 'Upload and edit multiple videos';
      case 'processing':
        return 'Apply video processing operations';
      case 'audio-remove':
        return 'Remove audio from specific time segments';
      case 'trim':
        return 'Trim video segments and optionally join them';
      case 'profanity':
        return 'Detect and mute inappropriate language';
      case 'history':
        return 'View and manage edit history';
      default:
        return '';
    }
  };

  const hasContent = uploadResponse || (videos.length > 0);

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
              Enhanced Video Processor
            </h1>
            <div className="p-2 bg-green-600 rounded-lg">
              <Server className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Professional video editing with multi-video support, transcript analysis, custom profanity filtering, and version history. 
            Powered by Express.js backend with FFmpeg and Whisper AI.
          </p>
          <div className="flex items-center justify-center space-x-4 text-sm">
            <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
              <Server className="w-4 h-4" />
              <span>Backend Processing</span>
            </div>
            <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <Layers className="w-4 h-4" />
              <span>Multi-Video Support</span>
            </div>
            <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400">
              <Brain className="w-4 h-4" />
              <span>AI Transcription</span>
            </div>
            <div className="flex items-center space-x-2 text-orange-600 dark:text-orange-400">
              <History className="w-4 h-4" />
              <span>Version History</span>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
            <TabsTrigger value="upload" className="gap-2">
              {getTabIcon('upload')}
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="multi-video" className="gap-2">
              {getTabIcon('multi-video')}
              <span className="hidden sm:inline">Multi</span>
            </TabsTrigger>
            {hasContent && (
              <>
                <TabsTrigger value="processing" className="gap-2">
                  {getTabIcon('processing')}
                  <span className="hidden sm:inline">Process</span>
                </TabsTrigger>
                <TabsTrigger value="audio-remove" className="gap-2">
                  {getTabIcon('audio-remove')}
                  <span className="hidden sm:inline">Audio</span>
                </TabsTrigger>
                <TabsTrigger value="trim" className="gap-2">
                  {getTabIcon('trim')}
                  <span className="hidden sm:inline">Trim</span>
                </TabsTrigger>
                <TabsTrigger value="profanity" className="gap-2">
                  {getTabIcon('profanity')}
                  <span className="hidden sm:inline">Filter</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  {getTabIcon('history')}
                  <span className="hidden sm:inline">History</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card className="border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Single Video Upload</span>
                  <Badge variant="outline" className="gap-1">
                    <Server className="w-3 h-3" />
                    Backend
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Upload a single video for processing with FFmpeg
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload onFileSelect={handleFileSelect} maxSize={50 * 1024 * 1024 * 1024} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Multi-Video Tab */}
          <TabsContent value="multi-video" className="space-y-6">
            <Card className="border-2 border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Layers className="w-5 h-5" />
                  <span>Multi-Video Upload</span>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    Multiple
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Upload multiple videos for advanced editing and joining
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sessionId ? (
                  <MultiVideoUpload 
                    sessionId={sessionId}
                    onFilesSelect={handleMultiFileSelect} 
                    maxSize={50 * 1024 * 1024 * 1024} 
                  />
                ) : (
                  <div className="text-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p>Initializing session...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {videos.length > 0 && (
              <MultiVideoEditor
                sessionId={sessionId}
                videos={videos}
                onProcessComplete={handleMultiVideoProcessComplete}
              />
            )}
          </TabsContent>

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

          {hasContent && (
            <>
              {/* Processing Tab */}
              <TabsContent value="processing" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Video Player + Version Selector */}
                  <div className="flex flex-col items-center space-y-6">
                    <Card className="w-full bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6 flex flex-col items-center">
                      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
                      <VideoPlayer
                        uploadResponse={uploadResponse}
                        processedVideoUrl={getCurrentVideoUrl()}
                        className="rounded-lg shadow-lg"
                        onTimeUpdate={handleTimeSeek}
                        onDurationChange={handleDurationChange}
                      />
                      {sessionId && (
                        <div className="w-full mt-6">
                          <VersionHistory
                            sessionId={sessionId}
                            onVersionSelect={setSelectedVersion}
                            selectedVersion={selectedVersion}
                            className="bg-white/80 dark:bg-gray-800/80 border rounded-lg shadow p-4"
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                  {/* Right: Controls */}
                  <div className="flex flex-col space-y-6">
                    <Card className="bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Wand2 className="w-5 h-5" />
                          <span>Quick Actions</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button
                          onClick={handleGetTranscript}
                          disabled={isProcessing}
                          className="w-full gap-2"
                          variant="outline"
                        >
                          <FileText className="w-4 h-4" />
                          Get Transcript
                        </Button>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Processing Mode</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={() => setActiveTab('audio-remove')}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <VolumeX className="w-3 h-3" />
                              Audio
                            </Button>
                            <Button
                              onClick={() => setActiveTab('trim')}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Scissors className="w-3 h-3" />
                              Trim
                            </Button>
                            <Button
                              onClick={() => setActiveTab('profanity')}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Shield className="w-3 h-3" />
                              Filter
                            </Button>
                          </div>
                        </div>

                        {processedVideoUrl && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Button onClick={handleDownload} className="w-full gap-2">
                                <Download className="w-4 h-4" />
                                Download Processed Video
                              </Button>
                              <Button onClick={handleCleanup} variant="outline" className="w-full gap-2">
                                <FileText className="w-4 h-4" />
                                Clean Up Session
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Wand2 className="w-5 h-5" />
                          <span>Quick Actions</span>
                        </CardTitle>
                        <CardDescription>
                          Common video processing operations
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button
                          onClick={handleGetTranscript}
                          disabled={isProcessing}
                          className="w-full gap-2"
                          variant="outline"
                        >
                          <FileText className="w-4 h-4" />
                          Get Transcript
                        </Button>

                        <Separator />

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Processing Mode</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              onClick={() => setActiveTab('audio-remove')}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <VolumeX className="w-3 h-3" />
                              Audio
                            </Button>
                            <Button
                              onClick={() => setActiveTab('trim')}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Scissors className="w-3 h-3" />
                              Trim
                            </Button>
                            <Button
                              onClick={() => setActiveTab('profanity')}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Shield className="w-3 h-3" />
                              Filter
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Profanity Tab */}
              <TabsContent value="profanity" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Video Player + Version Selector */}
                  <div className="flex flex-col items-center space-y-6">
                    <Card className="w-full bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6 flex flex-col items-center">
                      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
                      <VideoPlayer
                        uploadResponse={uploadResponse}
                        processedVideoUrl={getCurrentVideoUrl()}
                        className="rounded-lg shadow-lg"
                        onTimeUpdate={handleTimeSeek}
                        onDurationChange={handleDurationChange}
                      />
                      {sessionId && (
                        <div className="w-full mt-6">
                          <VersionHistory
                            sessionId={sessionId}
                            onVersionSelect={setSelectedVersion}
                            selectedVersion={selectedVersion}
                            className="bg-white/80 dark:bg-gray-800/80 border rounded-lg shadow p-4"
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                  {/* Right: Controls */}
                  <div className="flex flex-col space-y-6">
                    <Card className="bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Shield className="w-5 h-5" />
                          <span>Profanity Filtering</span>
                        </CardTitle>
                        <CardDescription>
                          Get transcript, select words to mute, and process video
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Get Transcript Button */}
                        {!showTranscript && (
                          <Button
                            onClick={handleGetTranscript}
                            disabled={isProcessing || !videoDuration}
                            className="w-full gap-2"
                            size="lg"
                          >
                            {isProcessing ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Getting Transcript...
                              </>
                            ) : (
                              <>
                                <FileText className="w-4 h-4" />
                                Get Transcript
                              </>
                            )}
                          </Button>
                        )}

                        {/* Show transcript and word selection after getting transcript */}
                        {showTranscript && (
                          <>
                            <TranscriptViewer
                              transcript={transcript}
                              profanitySegments={profanityData}
                              onTimeSeek={handleTimeSeek}
                              onWordsSelected={handleWordsSelected}
                              className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl"
                            />
                            {/* Mute and Process Button */}
                            <div className="space-y-3">
                              {selectedWords.length > 0 && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <VolumeX className="w-4 h-4 text-blue-600" />
                                    <span className="font-medium text-blue-800 dark:text-blue-200">
                                      Selected Words for Muting ({selectedWords.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {selectedWords.map((word, index) => (
                                      <Badge key={index} variant="secondary" className="text-xs">
                                        {word}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <Button
                                onClick={handleMuteAndProcess}
                                disabled={isProcessing || selectedWords.length === 0}
                                className="w-full gap-2"
                                size="lg"
                              >
                                {isProcessing ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Muting and Processing...
                                  </>
                                ) : (
                                  <>
                                    <VolumeX className="w-4 h-4" />
                                    Mute and Process Video
                                  </>
                                )}
                              </Button>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* Audio Remove Tab */}
              <TabsContent value="audio-remove" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Video Player + Version Selector */}
                  <div className="flex flex-col items-center space-y-6">
                    <Card className="w-full bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6 flex flex-col items-center">
                      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
                      <VideoPlayer
                        uploadResponse={uploadResponse}
                        processedVideoUrl={getCurrentVideoUrl()}
                        className="rounded-lg shadow-lg"
                        onTimeUpdate={handleTimeSeek}
                        onDurationChange={handleDurationChange}
                      />
                      {sessionId && (
                        <div className="w-full mt-6">
                          <VersionHistory
                            sessionId={sessionId}
                            onVersionSelect={setSelectedVersion}
                            selectedVersion={selectedVersion}
                            className="bg-white/80 dark:bg-gray-800/80 border rounded-lg shadow p-4"
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                  {/* Right: Controls */}
                  <div className="flex flex-col space-y-6">
                    <Card className="bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <VolumeX className="w-5 h-5" />
                          <span>Audio Removal</span>
                        </CardTitle>
                        <CardDescription>
                          Remove audio from specific time segments
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <Button
                          onClick={handleProcess}
                          disabled={isProcessing || audioSegments.length === 0 || !videoDuration}
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
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Timeline */}
                {videoDuration > 0 && (
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Clock className="w-5 h-5" />
                        <span>Timeline Editor</span>
                      </CardTitle>
                      <CardDescription>
                        Add and edit segments for audio removal operations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Timeline
                        duration={videoDuration}
                        currentTime={currentTime}
                        segments={audioSegments}
                        onSegmentsChange={setAudioSegments}
                        onTimeSeek={handleTimeSeek}
                        mode="audio-remove"
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Trim Tab */}
              <TabsContent value="trim" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Video Player + Version Selector */}
                  <div className="flex flex-col items-center space-y-6">
                    <Card className="w-full bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6 flex flex-col items-center">
                      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
                      <VideoPlayer
                        uploadResponse={uploadResponse}
                        processedVideoUrl={getCurrentVideoUrl()}
                        className="rounded-lg shadow-lg"
                        onTimeUpdate={handleTimeSeek}
                        onDurationChange={handleDurationChange}
                      />
                      {sessionId && (
                        <div className="w-full mt-6">
                          <VersionHistory
                            sessionId={sessionId}
                            onVersionSelect={setSelectedVersion}
                            selectedVersion={selectedVersion}
                            className="bg-white/80 dark:bg-gray-800/80 border rounded-lg shadow p-4"
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                  {/* Right: Controls */}
                  <div className="flex flex-col space-y-6">
                    <Card className="bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6">
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Scissors className="w-5 h-5" />
                          <span>Video Trimming</span>
                        </CardTitle>
                        <CardDescription>
                          Trim video segments and optionally join them
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
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

                        <Button
                          onClick={handleProcess}
                          disabled={isProcessing || trimSegments.length === 0 || !videoDuration}
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
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Timeline */}
                {videoDuration > 0 && (
                  <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Clock className="w-5 h-5" />
                        <span>Timeline Editor</span>
                      </CardTitle>
                      <CardDescription>
                        Add and edit segments for trimming operations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Timeline
                        duration={videoDuration}
                        currentTime={currentTime}
                        segments={trimSegments}
                        onSegmentsChange={setTrimSegments}
                        onTimeSeek={handleTimeSeek}
                        mode="trim"
                      />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Video Player + Version Selector */}
                  <div className="flex flex-col items-center space-y-6">
                    <Card className="w-full bg-white/90 dark:bg-gray-900/80 shadow-xl rounded-xl p-6 flex flex-col items-center">
                      <h2 className="text-xl font-semibold mb-4">Video Preview</h2>
                      <VideoPlayer
                        uploadResponse={uploadResponse}
                        processedVideoUrl={getCurrentVideoUrl()}
                        className="rounded-lg shadow-lg"
                        onTimeUpdate={handleTimeSeek}
                        onDurationChange={handleDurationChange}
                      />

                      {/* Version History */}
                      {sessionId ? (
                        <div className="w-full mt-6">
                          <VersionHistory
                            sessionId={sessionId}
                            onVersionSelect={setSelectedVersion}
                            selectedVersion={selectedVersion}
                            className="bg-white/80 dark:bg-gray-800/80 border rounded-lg shadow p-4"
                          />
                        </div>
                      ) : (
                        <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-xl">
                          <CardContent className="p-12 text-center">
                            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No Session Available</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                              Upload videos to start tracking edit history
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Processing Error */}
        {processingError && (
          <ProcessingProgress
            progress={null}
            isProcessing={false}
            error={processingError}
          />
        )}

        {/* Download Button for Processed Video */}
        {processedVideoUrl && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-600 rounded-lg">
                    <Download className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">
                      Video Processing Complete!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your processed video is ready for download
                    </p>
                  </div>
                </div>
                <Button onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" />
                  Download Video
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add this button below the main tabs or in a utility/settings area: */}
        <div className="flex justify-end mt-8">
          <Button
            variant="destructive"
            onClick={async () => {
              const res = await fetch('http://localhost:3001/api/cleanup', { method: 'POST' });
              if (res.ok) {
                alert('Cleanup complete! All uploaded, processed, and temp files have been deleted.');
                window.location.reload();
              } else {
                alert('Cleanup failed.');
              }
            }}
          >
            Cleanup All Videos
          </Button>
        </div>
      </div>
    </div>
  );
}