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
  Play, 
  AlertTriangle, 
  CheckCircle,
  Search,
  Volume2,
  VolumeX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  TranscriptEntry, 
  ProfanitySegment, 
  HighlightedWord
} from '@/lib/api';

interface TranscriptViewerProps {
  transcript: TranscriptEntry[];
  profanitySegments: ProfanitySegment[];
  onTimeSeek?: (time: number) => void;
  onWordsSelected?: (words: string[]) => void;
  className?: string;
}

export default function TranscriptViewer({
  transcript,
  profanitySegments,
  onTimeSeek,
  onWordsSelected,
  className
}: TranscriptViewerProps) {
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [showProfanityOnly, setShowProfanityOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const toggleWordSelection = (word: string) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word.toLowerCase())) {
      newSelected.delete(word.toLowerCase());
    } else {
      newSelected.add(word.toLowerCase());
    }
    setSelectedWords(newSelected);
    onWordsSelected?.(Array.from(newSelected));
  };

  const selectAllProfaneWords = () => {
    const allProfaneWords = new Set<string>();
    profanitySegments.forEach(segment => {
      segment.highlightedWords.forEach(hw => {
        if (hw.isProfane) {
          allProfaneWords.add(hw.word.toLowerCase());
        }
      });
    });
    setSelectedWords(allProfaneWords);
    onWordsSelected?.(Array.from(allProfaneWords));
  };

  const clearSelection = () => {
    setSelectedWords(new Set());
    onWordsSelected?.([]);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getWordClassName = (word: HighlightedWord) => {
    const baseClass = 'px-1 py-0.5 rounded cursor-pointer transition-colors';
    const isSelected = selectedWords.has(word.word.toLowerCase());
    
    if (word.isProfane) {
      if (isSelected) {
        return `${baseClass} bg-red-600 text-white`;
      }
      switch (word.detectedBy) {
        case 'filter':
          return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 hover:bg-red-200`;
        case 'list':
          return `${baseClass} bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200 hover:bg-orange-200`;
        default:
          return `${baseClass} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200 hover:bg-red-200`;
      }
    }
    
    if (isSelected) {
      return `${baseClass} bg-blue-600 text-white`;
    }
    
    return `${baseClass} hover:bg-gray-100 dark:hover:bg-gray-700`;
  };

  const filteredTranscript = transcript.filter(entry => {
    if (showProfanityOnly) {
      const hasProfanity = profanitySegments.some(ps => ps.index === entry.index);
      if (!hasProfanity) return false;
    }
    
    if (searchTerm) {
      return entry.text.toLowerCase().includes(searchTerm.toLowerCase());
    }
    
    return true;
  });

  const getProfanitySegmentForEntry = (entry: TranscriptEntry) => {
    return profanitySegments.find(ps => ps.index === entry.index);
  };

  console.log('TranscriptViewer - transcript:', transcript);
  console.log('TranscriptViewer - profanitySegments:', profanitySegments);
  console.log('TranscriptViewer - filteredTranscript:', filteredTranscript);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5" />
          <span>Transcript & Profanity Detection</span>
          <Badge variant="outline">
            {transcript.length} segments
          </Badge>
        </CardTitle>
        <CardDescription>
          Review transcript and select words to mute
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search transcript..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="profanity-only"
                checked={showProfanityOnly}
                onCheckedChange={setShowProfanityOnly}
              />
              <Label htmlFor="profanity-only" className="text-sm">
                Show profanity only
              </Label>
            </div>
          </div>

          {/* Selection Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={selectAllProfaneWords}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <CheckCircle className="w-3 h-3" />
              Select All Profane
            </Button>
            <Button
              onClick={clearSelection}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <VolumeX className="w-3 h-3" />
              Clear Selection
            </Button>
            <Badge variant="secondary">
              {selectedWords.size} words selected
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Legend */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Profanity Detection Legend</Label>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-100 dark:bg-red-900/20 rounded"></div>
              <span>Filter Detected</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-orange-100 dark:bg-orange-900/20 rounded"></div>
              <span>List Detected</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 bg-red-600 rounded"></div>
              <span>Selected for Muting</span>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredTranscript.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No matching transcript entries found' : 'No transcript entries to display'}
            </div>
          ) : (
            filteredTranscript.map((entry) => {
              const profanitySegment = getProfanitySegmentForEntry(entry);
              const hasProfanity = !!profanitySegment;

              return (
                <div
                  key={entry.index}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    hasProfanity 
                      ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/10'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        #{entry.index}
                      </Badge>
                      <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                        {formatTime(entry.startSeconds)} - {formatTime(entry.endSeconds)}
                      </span>
                      {hasProfanity && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Profanity
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTimeSeek?.(entry.startSeconds)}
                      className="gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Seek
                    </Button>
                  </div>

                  <div className="text-sm leading-relaxed">
                    {profanitySegment ? (
                      // Render with highlighted words
                      <div className="space-x-1">
                        {profanitySegment.highlightedWords.map((hw, wordIndex) => (
                          <span
                            key={wordIndex}
                            className={getWordClassName(hw)}
                            onClick={() => toggleWordSelection(hw.word.toLowerCase())}
                            title={hw.isProfane ? `Detected by: ${hw.detectedBy}` : undefined}
                          >
                            {hw.word}
                          </span>
                        ))}
                      </div>
                    ) : (
                      // Render plain text for non-profane entries
                      <div className="space-x-1">
                        {entry.text.split(' ').map((word, wordIndex) => (
                          <span
                            key={wordIndex}
                            className={cn(
                              'px-1 py-0.5 rounded cursor-pointer transition-colors',
                              selectedWords.has(word.toLowerCase())
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            )}
                            onClick={() => toggleWordSelection(word.toLowerCase())}
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Summary */}
        {selectedWords.size > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2 mb-2">
              <Volume2 className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-800 dark:text-blue-200">
                Selected Words for Muting
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {Array.from(selectedWords).map((word) => (
                <Badge key={word} variant="secondary" className="text-xs">
                  {word}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}