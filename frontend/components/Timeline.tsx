'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Clock, Edit3, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineSegment {
  id: string;
  start: number;
  end: number;
  type: 'audio-remove' | 'trim' | 'profanity';
}

interface TimelineProps {
  duration: number;
  currentTime: number;
  segments: TimelineSegment[];
  onSegmentsChange: (segments: TimelineSegment[]) => void;
  onTimeSeek: (time: number) => void;
  mode: 'audio-remove' | 'trim' | 'profanity';
  className?: string;
}

export default function Timeline({
  duration,
  currentTime,
  segments,
  onSegmentsChange,
  onTimeSeek,
  mode,
  className
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<{
    segmentId: string;
    handle: 'start' | 'end' | 'move';
    offset: number;
  } | null>(null);
  
  // Manual segment creation
  const [newSegmentStart, setNewSegmentStart] = useState<string>('');
  const [newSegmentEnd, setNewSegmentEnd] = useState<string>('');
  const [editingSegment, setEditingSegment] = useState<string | null>(null);
  const [editStart, setEditStart] = useState<string>('');
  const [editEnd, setEditEnd] = useState<string>('');

  const getColorClass = (type: string) => {
    switch (type) {
      case 'audio-remove':
        return 'bg-red-500/70 border-red-500 hover:bg-red-500/80';
      case 'trim':
        return 'bg-blue-500/70 border-blue-500 hover:bg-blue-500/80';
      case 'profanity':
        return 'bg-orange-500/70 border-orange-500 hover:bg-orange-500/80';
      default:
        return 'bg-gray-500/70 border-gray-500 hover:bg-gray-500/80';
    }
  };

  const getModeLabel = (type: string) => {
    switch (type) {
      case 'audio-remove':
        return 'Audio Remove';
      case 'trim':
        return 'Trim';
      case 'profanity':
        return 'Profanity Filter';
      default:
        return 'Unknown';
    }
  };

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current || isDragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    
    onTimeSeek(Math.max(0, Math.min(duration, time)));
  }, [duration, isDragging, onTimeSeek]);

  const addSegmentAtCurrentTime = () => {
    const newSegment: TimelineSegment = {
      id: Date.now().toString(),
      start: Math.max(0, currentTime - 1),
      end: Math.min(duration, currentTime + 1),
      type: mode
    };

    onSegmentsChange([...segments, newSegment]);
  };

  // Enhanced time parsing function
  const parseTimeInput = (timeStr: string): number => {
    if (!timeStr.trim()) return 0;
    
    // Handle MM:SS format
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const minutes = parseInt(parts[0]) || 0;
        const seconds = parseFloat(parts[1]) || 0;
        return minutes * 60 + seconds;
      } else if (parts.length === 3) {
        // Handle HH:MM:SS format
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
      }
    }
    
    // Handle plain seconds
    return parseFloat(timeStr) || 0;
  };

  const addManualSegment = () => {
    const start = parseTimeInput(newSegmentStart);
    const end = parseTimeInput(newSegmentEnd);

    if (start >= end || start < 0 || end > duration) {
      alert(`Please enter valid start and end times. Start: ${start}s, End: ${end}s, Duration: ${duration}s`);
      return;
    }

    const newSegment: TimelineSegment = {
      id: Date.now().toString(),
      start,
      end,
      type: mode
    };

    onSegmentsChange([...segments, newSegment]);
    setNewSegmentStart('');
    setNewSegmentEnd('');
  };

  const removeSegment = (id: string) => {
    onSegmentsChange(segments.filter(s => s.id !== id));
  };

  const updateSegment = (id: string, updates: Partial<TimelineSegment>) => {
    onSegmentsChange(segments.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const startEditingSegment = (segment: TimelineSegment) => {
    setEditingSegment(segment.id);
    setEditStart(formatTimeForInput(segment.start));
    setEditEnd(formatTimeForInput(segment.end));
  };

  const saveEditedSegment = () => {
    if (!editingSegment) return;

    const start = parseTimeInput(editStart);
    const end = parseTimeInput(editEnd);

    if (start >= end || start < 0 || end > duration) {
      alert(`Please enter valid start and end times. Start: ${start}s, End: ${end}s, Duration: ${duration}s`);
      return;
    }

    updateSegment(editingSegment, { start, end });
    setEditingSegment(null);
    setEditStart('');
    setEditEnd('');
  };

  const cancelEditing = () => {
    setEditingSegment(null);
    setEditStart('');
    setEditEnd('');
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  const formatTimeForInput = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = (time % 60).toFixed(2);
    return `${minutes}:${seconds.padStart(5, '0')}`;
  };

  const handleMouseDown = (e: React.MouseEvent, segmentId: string, handle: 'start' | 'end' | 'move') => {
    e.stopPropagation();
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const offset = e.clientX - rect.left;
    
    setIsDragging({ segmentId, handle, offset });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    const clampedTime = Math.max(0, Math.min(duration, time));

    const segment = segments.find(s => s.id === isDragging.segmentId);
    if (!segment) return;

    if (isDragging.handle === 'start') {
      updateSegment(isDragging.segmentId, { 
        start: Math.min(clampedTime, segment.end - 0.1) 
      });
    } else if (isDragging.handle === 'end') {
      updateSegment(isDragging.segmentId, { 
        end: Math.max(clampedTime, segment.start + 0.1) 
      });
    } else if (isDragging.handle === 'move') {
      const segmentDuration = segment.end - segment.start;
      const newStart = Math.max(0, Math.min(duration - segmentDuration, clampedTime - segmentDuration / 2));
      updateSegment(isDragging.segmentId, {
        start: newStart,
        end: newStart + segmentDuration
      });
    }
  }, [isDragging, segments, duration, updateSegment]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Clock className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold">Timeline Editor</h3>
          <Badge variant="outline" className="gap-1">
            {getModeLabel(mode)}
          </Badge>
        </div>
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          {segments.length} segments
        </Badge>
      </div>

      {/* Add Segment Controls */}
      <Card className="bg-gray-50 dark:bg-gray-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Segments</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Add at Current Time */}
          <div className="flex items-center space-x-2">
            <Button 
              onClick={addSegmentAtCurrentTime} 
              size="sm" 
              className="gap-2"
              variant="outline"
            >
              <Plus className="w-4 h-4" />
              Add at Current Time ({formatTime(currentTime)})
            </Button>
            <Button
              onClick={() => onTimeSeek(Math.max(0, currentTime - 5))}
              size="sm"
              variant="ghost"
              disabled={currentTime <= 0}
            >
              -5s
            </Button>
            <Button
              onClick={() => onTimeSeek(Math.min(duration, currentTime + 5))}
              size="sm"
              variant="ghost"
              disabled={currentTime >= duration}
            >
              +5s
            </Button>
          </div>

          <Separator />

          {/* Manual Segment Creation */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Manual Segment Creation</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="start-time" className="text-xs">Start Time</Label>
                <Input
                  id="start-time"
                  placeholder="0:00 or 30"
                  value={newSegmentStart}
                  onChange={(e) => setNewSegmentStart(e.target.value)}
                  className="h-8"
                />
                <p className="text-xs text-gray-500">Format: MM:SS or seconds</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="end-time" className="text-xs">End Time</Label>
                <Input
                  id="end-time"
                  placeholder="0:10 or 40"
                  value={newSegmentEnd}
                  onChange={(e) => setNewSegmentEnd(e.target.value)}
                  className="h-8"
                />
                <p className="text-xs text-gray-500">Format: MM:SS or seconds</p>
              </div>
            </div>
            <Button 
              onClick={addManualSegment} 
              size="sm" 
              className="w-full gap-2"
              disabled={!newSegmentStart || !newSegmentEnd}
            >
              <Plus className="w-4 h-4" />
              Add Manual Segment
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Visualization */}
      <div className="relative">
        <div 
          ref={timelineRef}
          onClick={handleTimelineClick}
          className="relative h-20 bg-gray-200 dark:bg-gray-700 rounded-lg cursor-pointer border-2 border-transparent hover:border-blue-300 transition-colors"
        >
          {/* Time Markers */}
          <div className="absolute inset-0 flex justify-between items-end p-2 pointer-events-none">
            {Array.from({ length: 11 }, (_, i) => {
              const time = (duration * i) / 10;
              return (
                <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(time)}
                </div>
              );
            })}
          </div>

          {/* Current Time Indicator */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-20 pointer-events-none"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          >
            <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-500 rotate-45 transform -translate-y-1/2"></div>
          </div>

          {/* Segments */}
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                'absolute top-3 bottom-3 rounded border-2 cursor-move flex items-center justify-center group transition-colors',
                getColorClass(segment.type)
              )}
              style={{
                left: `${(segment.start / duration) * 100}%`,
                width: `${((segment.end - segment.start) / duration) * 100}%`
              }}
              onMouseDown={(e) => handleMouseDown(e, segment.id, 'move')}
            >
              {/* Start Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 bg-white/30 cursor-ew-resize hover:bg-white/50 transition-colors"
                onMouseDown={(e) => handleMouseDown(e, segment.id, 'start')}
              />
              
              {/* End Handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 bg-white/30 cursor-ew-resize hover:bg-white/50 transition-colors"
                onMouseDown={(e) => handleMouseDown(e, segment.id, 'end')}
              />

              {/* Segment Label */}
              <span className="text-white text-xs font-medium truncate px-2 pointer-events-none">
                {formatTime(segment.start)} - {formatTime(segment.end)}
              </span>

              {/* Control Buttons */}
              <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditingSegment(segment);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white h-6 w-6 p-0"
                >
                  <Edit3 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSegment(segment.id);
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white h-6 w-6 p-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Segment List */}
      {segments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Segment List ({segments.length} segments)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {segments.map((segment, index) => (
              <div
                key={segment.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                {editingSegment === segment.id ? (
                  <div className="flex items-center space-x-2 flex-1">
                    <span className="text-sm font-medium w-16">#{index + 1}</span>
                    <Input
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      placeholder="0:00"
                      className="h-8 w-24"
                    />
                    <span className="text-sm">to</span>
                    <Input
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      placeholder="0:10"
                      className="h-8 w-24"
                    />
                    <Button onClick={saveEditedSegment} size="sm" className="h-8">
                      Save
                    </Button>
                    <Button onClick={cancelEditing} size="sm" variant="outline" className="h-8">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className="w-8 justify-center">
                        {index + 1}
                      </Badge>
                      <span className="text-sm">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {((segment.end - segment.start)).toFixed(1)}s
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTimeSeek(segment.start)}
                        className="h-8 w-8 p-0"
                        title="Seek to start"
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditingSegment(segment)}
                        className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600"
                        title="Edit segment"
                      >
                        <Edit3 className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSegment(segment.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                        title="Delete segment"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p className="font-medium">How to add segments:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Click "Add at Current Time" to create a 2-second segment around the current playback position</li>
              <li>Use manual input with MM:SS format (e.g., "1:30") or plain seconds (e.g., "90")</li>
              <li>Click on the timeline to seek to a specific time</li>
              <li>Drag segments to move them or drag the handles to resize</li>
              <li>Use the edit button to modify segment times precisely</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}