'use client';

import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { ProcessingProgress as ProgressType } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProcessingProgressProps {
  progress: ProgressType | null;
  isProcessing: boolean;
  error?: string;
  className?: string;
}

export default function ProcessingProgress({
  progress,
  isProcessing,
  error,
  className
}: ProcessingProgressProps) {
  if (!isProcessing && !progress && !error) {
    return null;
  }

  const getStatusIcon = () => {
    if (error) {
      return <AlertCircle className="w-5 h-5 text-red-500" />;
    }
    if (progress?.phase === 'Complete') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
  };

  const getStatusColor = () => {
    if (error) return 'text-red-600 dark:text-red-400';
    if (progress?.phase === 'Complete') return 'text-green-600 dark:text-green-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const progressValue = progress ? progress.progress * 100 : 0;

  return (
    <div className={cn(
      'space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg',
      className
    )}>
      <div className="flex items-center space-x-3">
        {getStatusIcon()}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className={cn('font-semibold', getStatusColor())}>
              {error ? 'Processing Error' : progress?.phase || 'Processing...'}
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(progressValue)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {error || progress?.message || 'Initializing...'}
          </p>
        </div>
      </div>

      {!error && (
        <div className="space-y-2">
          <Progress 
            value={progressValue} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {progress?.phase === 'Complete' && (
        <div className="flex items-center space-x-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">
            Processing completed successfully!
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700 dark:text-red-300 font-medium">
            {error}
          </span>
        </div>
      )}
    </div>
  );
}