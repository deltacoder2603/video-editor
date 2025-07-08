'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  History, 
  Download, 
  Play, 
  Scissors, 
  VolumeX, 
  Shield, 
  Video,
  Clock,
  FileText,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  EditHistoryEntry, 
  SessionHistoryResponse, 
  getSessionHistory,
  downloadVideo,
  formatFileSize,
  formatDuration
} from '@/lib/api';

interface VersionHistoryProps {
  sessionId: string;
  onVersionSelect?: (version: string) => void;
  selectedVersion?: string;
  className?: string;
}

export default function VersionHistory({
  sessionId,
  onVersionSelect,
  selectedVersion = 'original',
  className
}: VersionHistoryProps) {
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (sessionId) {
      loadSessionHistory();
    }
  }, [sessionId]);

  const loadSessionHistory = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const history = await getSessionHistory(sessionId);
      setSessionHistory(history);
    } catch (error) {
      console.error('Failed to load session history:', error);
      setError('Failed to load version history');
    } finally {
      setIsLoading(false);
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'audio_removal':
        return <VolumeX className="w-4 h-4" />;
      case 'trim':
        return <Scissors className="w-4 h-4" />;
      case 'profanity_filter':
        return <Shield className="w-4 h-4" />;
      case 'multi_trim_join':
        return <Video className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getOperationLabel = (type: string) => {
    switch (type) {
      case 'audio_removal':
        return 'Audio Removal';
      case 'trim':
        return 'Video Trimming';
      case 'profanity_filter':
        return 'Profanity Filter';
      case 'multi_trim_join':
        return 'Multi-Video Join';
      default:
        return 'Unknown Operation';
    }
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'audio_removal':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';
      case 'trim':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'profanity_filter':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200';
      case 'multi_trim_join':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getVersionDescription = (entry: EditHistoryEntry) => {
    switch (entry.type) {
      case 'audio_removal':
        return `Removed audio from ${entry.segments?.length || 0} segments`;
      case 'trim':
        return `Trimmed ${entry.segments?.length || 0} segments${entry.joinSegments ? ' (joined)' : ''}`;
      case 'profanity_filter':
        return `Muted ${entry.segmentsMuted || 0} profane segments${entry.selectedWords?.length ? ` + ${entry.selectedWords.length} custom words` : ''}`;
      case 'multi_trim_join':
        return `Joined segments from ${entry.videoSegments?.length || 0} videos`;
      default:
        return 'Unknown operation';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-2">Loading version history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sessionHistory) {
    return null;
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <History className="w-5 h-5" />
          <span>Version History</span>
          <Badge variant="outline">
            {sessionHistory.history.length + 1} versions
          </Badge>
        </CardTitle>
        <CardDescription>
          Select a version to edit or download processed videos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Version Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Version to Edit</label>
          <Select value={selectedVersion} onValueChange={onVersionSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="original">
                <div className="flex items-center space-x-2">
                  <Video className="w-4 h-4" />
                  <span>Original Video</span>
                </div>
              </SelectItem>
              {sessionHistory.history.map((entry) => (
                <SelectItem key={entry.version} value={entry.version.toString()}>
                  <div className="flex items-center space-x-2">
                    {getOperationIcon(entry.type)}
                    <span>Version {entry.version} - {getOperationLabel(entry.type)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Session Info */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center space-x-2">
            <Layers className="w-4 h-4" />
            <span>Session Overview</span>
          </h4>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Videos:</span>
              <span className="ml-2 font-medium">{sessionHistory.session.videos.length}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Current Version:</span>
              <span className="ml-2 font-medium">{sessionHistory.session.currentVersion}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Created:</span>
              <span className="ml-2 font-medium">{formatTimestamp(sessionHistory.session.createdAt)}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Size:</span>
              <span className="ml-2 font-medium">
                {formatFileSize(sessionHistory.session.videos.reduce((sum, v) => sum + v.size, 0))}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Version Timeline */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>Edit Timeline</span>
          </h4>

          <div className="space-y-3">
            {/* Original Version */}
            <div className={cn(
              'p-4 rounded-lg border-2 transition-colors',
              selectedVersion === 'original' 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                : 'border-gray-200 dark:border-gray-700'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Video className="w-5 h-5 text-gray-600" />
                  <div>
                    <h5 className="font-medium">Original Video</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Base version - {sessionHistory.session.videos.length} video(s)
                    </p>
                  </div>
                </div>
                <Badge variant="outline">v0</Badge>
              </div>
            </div>

            {/* Edit History */}
            {sessionHistory.history.map((entry, index) => (
              <div
                key={entry.version}
                className={cn(
                  'p-4 rounded-lg border-2 transition-colors',
                  selectedVersion === entry.version.toString()
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'border-gray-200 dark:border-gray-700'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={cn('p-2 rounded-lg', getOperationColor(entry.type))}>
                      {getOperationIcon(entry.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h5 className="font-medium">{getOperationLabel(entry.type)}</h5>
                        <Badge variant="outline">v{entry.version}</Badge>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {getVersionDescription(entry)}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Source: v{entry.sourceVersion}</span>
                        <span>{formatTimestamp(entry.timestamp)}</span>
                      </div>
                      
                      {/* Additional Details */}
                      {entry.selectedWords && entry.selectedWords.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Custom words:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {entry.selectedWords.slice(0, 5).map((word, wordIndex) => (
                              <Badge key={wordIndex} variant="secondary" className="text-xs">
                                {word}
                              </Badge>
                            ))}
                            {entry.selectedWords.length > 5 && (
                              <Badge variant="secondary" className="text-xs">
                                +{entry.selectedWords.length - 5} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadVideo(entry.filename)}
                      className="gap-1"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Selection Info */}
        {selectedVersion !== 'original' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <Play className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Editing Version {selectedVersion}
              </span>
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              New edits will be applied to this version and create a new version
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}