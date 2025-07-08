'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Video, FileX, CheckCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadMultipleVideos, MultiUploadResponse, ProcessingProgress, formatFileSize, formatDuration } from '@/lib/api';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface MultiVideoUploadProps {
  sessionId: string;
  onFilesSelect: (uploadResponse: MultiUploadResponse) => void;
  accept?: string;
  maxSize?: number;
  className?: string;
}

export default function MultiVideoUpload({ 
  sessionId,
  onFilesSelect, 
  accept = 'video/*', 
  maxSize = 50 * 1024 * 1024 * 1024, // 50GB
  className 
}: MultiVideoUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<ProcessingProgress | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      setUploadError(`File rejected: ${error.message}`);
      return;
    }

    if (acceptedFiles.length === 0) return;

    // Add to selected files instead of uploading immediately
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
    setUploadError('');
  }, []);

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadError('');
    setUploadProgress(null);

    try {
      console.log('Starting multi-upload:', selectedFiles.map(f => f.name));
      
      const uploadResponse = await uploadMultipleVideos(selectedFiles, sessionId, (progress) => {
        setUploadProgress(progress);
      });

      console.log('Multi-upload successful:', uploadResponse);
      onFilesSelect(uploadResponse);
      setSelectedFiles([]); // Clear selected files after successful upload
      
      // Clear progress after success
      setTimeout(() => {
        setUploadProgress(null);
      }, 2000);
      
    } catch (error) {
      console.error('Multi-upload failed:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp']
    },
    maxSize,
    multiple: true,
    disabled: isUploading
  });

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300',
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
              <Plus className="w-6 h-6 text-blue-600 absolute -top-1 -right-1" />
            </div>
          )}
          
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">
              {isUploading
                ? 'Uploading videos...'
                : isDragActive
                  ? isDragReject
                    ? 'Invalid file type'
                    : 'Drop your videos here'
                  : uploadProgress?.phase === 'Complete'
                    ? 'Upload completed!'
                    : 'Upload multiple videos'
              }
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Drag and drop or click to select multiple videos • Max size: {Math.round(maxSize / (1024 * 1024 * 1024))}GB each
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
              ✓ Multi-video editing and joining supported
            </p>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-700 dark:text-gray-300">
              Selected Videos ({selectedFiles.length})
            </h3>
            <Badge variant="outline">
              Total: {formatFileSize(totalSize)}
            </Badge>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <Video className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-600"
                  disabled={isUploading}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            onClick={uploadFiles}
            disabled={isUploading || selectedFiles.length === 0}
            className="w-full gap-2"
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading {selectedFiles.length} videos...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {selectedFiles.length} Video{selectedFiles.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}

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