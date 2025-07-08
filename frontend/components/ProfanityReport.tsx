'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Volume2, 
  VolumeX,
  Edit3,
  RotateCcw,
  Settings
} from 'lucide-react';

interface ProfanitySegment {
  start: number;
  end: number;
  confidence: number;
  detectedWords?: string[];
  originalText?: string;
  method?: string;
}

interface ProfanityReportProps {
  segments: ProfanitySegment[];
  totalDuration: number;
  detectionMethod: string;
  onSegmentEdit?: (segmentIndex: number, newStart: number, newEnd: number) => void;
  onSegmentRemove?: (segmentIndex: number) => void;
  onContinueWithOriginal?: () => void;
  onContinueWithProcessed?: () => void;
  className?: string;
}

export default function ProfanityReport({
  segments,
  totalDuration,
  detectionMethod,
  onSegmentEdit,
  onSegmentRemove,
  onContinueWithOriginal,
  onContinueWithProcessed,
  className
}: ProfanityReportProps) {
  const [showDetails, setShowDetails] = useState(true);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(1);
    return `${minutes}:${seconds.padStart(4, '0')}`;
  };

  const getTotalMutedTime = () => {
    return segments.reduce((total, segment) => total + (segment.end - segment.start), 0);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-red-600 bg-red-100 dark:bg-red-900/20';
    if (confidence >= 0.6) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
    return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
  };

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case 'allprofanity':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200';
      case 'ai':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200';
      case 'hybrid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>Profanity Detection Report</span>
          {segments.length === 0 ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          )}
        </CardTitle>
        <CardDescription>
          Analysis results using {detectionMethod} detection method
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {segments.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Segments Found
            </div>
          </div>
          
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {getTotalMutedTime().toFixed(1)}s
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Muted
            </div>
          </div>
          
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {((getTotalMutedTime() / totalDuration) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Video Affected
            </div>
          </div>
          
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {(segments.reduce((sum, s) => sum + s.confidence, 0) / segments.length || 0).toFixed(2)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Avg Confidence
            </div>
          </div>
        </div>

        {/* Detection Status */}
        {segments.length === 0 ? (
          <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                No Inappropriate Content Detected
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                The video appears to be clean based on our {detectionMethod} analysis.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-6 h-6 text-orange-600" />
            <div>
              <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                Inappropriate Content Detected
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Found {segments.length} segment{segments.length > 1 ? 's' : ''} that may contain inappropriate language.
              </p>
            </div>
          </div>
        )}

        {/* Show Details Toggle */}
        {segments.length > 0 && (
          <div className="flex items-center space-x-2">
            <Switch
              id="show-details"
              checked={showDetails}
              onCheckedChange={setShowDetails}
            />
            <Label htmlFor="show-details" className="text-sm">
              Show detailed segment information
            </Label>
          </div>
        )}

        {/* Detailed Segments List */}
        {segments.length > 0 && showDetails && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Detected Segments</span>
            </h4>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {segments.map((segment, index) => (
                <div
                  key={index}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="font-mono">
                        #{index + 1}
                      </Badge>
                      <div className="text-sm">
                        <span className="font-medium">
                          {formatTime(segment.start)} - {formatTime(segment.end)}
                        </span>
                        <span className="text-gray-500 ml-2">
                          ({(segment.end - segment.start).toFixed(1)}s)
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge className={getConfidenceColor(segment.confidence)}>
                        {Math.round(segment.confidence * 100)}% confidence
                      </Badge>
                      {segment.method && (
                        <Badge className={getMethodBadgeColor(segment.method)}>
                          {segment.method}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {segment.detectedWords && segment.detectedWords.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Detected words:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {segment.detectedWords.map((word, wordIndex) => (
                          <Badge key={wordIndex} variant="destructive" className="text-xs">
                            {word}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {segment.originalText && (
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        Transcript:
                      </p>
                      <p className="text-sm bg-gray-50 dark:bg-gray-700 p-2 rounded italic">
                        "{segment.originalText}"
                      </p>
                    </div>
                  )}

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingSegment(editingSegment === index ? null : index)}
                      className="gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      {editingSegment === index ? 'Cancel' : 'Edit'}
                    </Button>
                    
                    {onSegmentRemove && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSegmentRemove(index)}
                        className="gap-1 text-red-600 hover:text-red-700"
                      >
                        <VolumeX className="w-3 h-3" />
                        Remove
                      </Button>
                    )}
                  </div>

                  {/* Edit Form */}
                  {editingSegment === index && onSegmentEdit && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded border-t">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <Label className="text-xs">Start Time (seconds)</Label>
                          <input
                            type="number"
                            step="0.1"
                            defaultValue={segment.start}
                            className="w-full px-2 py-1 text-sm border rounded"
                            id={`start-${index}`}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">End Time (seconds)</Label>
                          <input
                            type="number"
                            step="0.1"
                            defaultValue={segment.end}
                            className="w-full px-2 py-1 text-sm border rounded"
                            id={`end-${index}`}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          const startInput = document.getElementById(`start-${index}`) as HTMLInputElement;
                          const endInput = document.getElementById(`end-${index}`) as HTMLInputElement;
                          const newStart = parseFloat(startInput.value);
                          const newEnd = parseFloat(endInput.value);
                          
                          if (newStart < newEnd && newStart >= 0 && newEnd <= totalDuration) {
                            onSegmentEdit(index, newStart, newEnd);
                            setEditingSegment(null);
                          } else {
                            alert('Invalid time range');
                          }
                        }}
                        className="gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Save Changes
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-4">
          <h4 className="font-medium flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Next Steps</span>
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {onContinueWithOriginal && (
              <Button
                variant="outline"
                onClick={onContinueWithOriginal}
                className="gap-2 h-auto p-4 flex-col items-start"
              >
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4" />
                  <span className="font-medium">Continue with Original</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 text-left">
                  Use the original video for further editing (audio removal, trimming, etc.)
                </p>
              </Button>
            )}
            
            {onContinueWithProcessed && segments.length > 0 && (
              <Button
                onClick={onContinueWithProcessed}
                className="gap-2 h-auto p-4 flex-col items-start"
              >
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4" />
                  <span className="font-medium">Continue with Processed</span>
                </div>
                <p className="text-xs text-white/80 text-left">
                  Use the profanity-filtered video for further editing
                </p>
              </Button>
            )}
          </div>
          
          <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <p className="font-medium mb-1">💡 Tip:</p>
            <p>
              You can continue editing with either the original video (if you want to apply different filters) 
              or the processed video (if you're satisfied with the profanity filtering and want to do additional edits).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}