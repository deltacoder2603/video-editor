'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Video, FileX, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadVideo, UploadResponse, ProcessingProgress } from '@/lib/api';
import { Progress } from '@/components/ui/progress';

interface FileUploadProps {
  onFileSelect: (uploadResponse: UploadResponse) => void;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export default function FileUpload({ 
  onFileSelect, 
  accept = 'video/*', 
  maxSize = 50 * 1024 * 1024 * 1024, // 50GB to match backend
  className 
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ProcessingProgress | null>(null);
  const [uploadError, setUploadError] = useState<string>('');

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      setUploadError(`File rejected: ${error.message}`);
      return;
    }

    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsUploading(true);
    setUploadError('');
    setUploadProgress(null);

    try {
      console.log('Starting upload:', file.name, 'Size:', file.size);
      
      const uploadResponse = await uploadVideo(file, (progress) => {
        setUploadProgress(progress);
      });

      console.log('Upload successful:', uploadResponse);
      onFileSelect(uploadResponse);
      
      // Clear progress after success
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);
      
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp']
    },
    maxSize,
    multiple: false,
    disabled: isUploading
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300',
          !isUploading && 'hover:scale-[1.02]',
          isDragActive && !isDragReject ? 
            'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 
            'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500',
          isDragReject && 'border-red-500 bg-red-50 dark:bg-red-950/20',
          isUploading && 'pointer-events-none opacity-75',
          className
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          {isUploading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : isDragReject ? (
            <FileX className="w-12 h-12 text-red-500" />
          ) : uploadProgress?.phase === 'Complete' ? (
            <CheckCircle className="w-12 h-12 text-green-500" />
          ) : (
            <div className="relative">
              <Video className="w-12 h-12 text-blue-500" />
              <Upload className="w-6 h-6 text-blue-600 absolute -top-1 -right-1" />
            </div>
          )}
          
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {isUploading
                ? 'Uploading video...'
                : isDragActive
                  ? isDragReject
                    ? 'Invalid file type'
                    : 'Drop your video here'
                  : uploadProgress?.phase === 'Complete'
                    ? 'Upload completed!'
                    : 'Upload your video file'
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag and drop or click to select • Max size: {Math.round(maxSize / (1024 * 1024 * 1024))}GB
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Supports vertical videos and all orientations
            </p>
          </div>
        </div>

        {/* Animated border effect */}
        <div className={cn(
          'absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300',
          'bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-teal-500/20',
          isDragActive && !isDragReject && 'opacity-100'
        )} />
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className="font-medium text-blue-800 dark:text-blue-200">
              {uploadProgress.phase}
            </span>
            <span className="text-sm text-blue-600 dark:text-blue-400">
              {Math.round(uploadProgress.progress * 100)}%
            </span>
          </div>
          <Progress value={uploadProgress.progress * 100} className="h-2" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            {uploadProgress.message}
          </p>
        </div>
      )}

      {/* Upload Error */}
      {uploadError && (
        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
          <FileX className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700 dark:text-red-300">{uploadError}</span>
        </div>
      )}
    </div>
  );
}