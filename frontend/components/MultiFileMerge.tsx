'use client';

import React, { useState } from 'react';

export default function MultiFileMerge() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setStatus('');
      setDownloadUrl('');
    }
  };

  const handleRemove = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    setStatus('Uploading and merging...');
    setDownloadUrl('');
    // 1. Upload files to backend and get their absolute paths
    const uploadedPaths: string[] = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('video', file);
      const res = await fetch('http://localhost:3001/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.path) {
        uploadedPaths.push(data.path);
      } else {
        setStatus('Upload failed for one or more files.');
        return;
      }
    }

    // 2. Call merge-multiple endpoint
    const mergeRes = await fetch('http://localhost:3001/api/merge-multiple', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoPaths: uploadedPaths,
        outputName: 'final_merged.mp4',
      }),
    });
    const mergeData = await mergeRes.json();
    if (mergeData.success && mergeData.outputFile) {
      setStatus('Merge complete!');
      setDownloadUrl(`http://localhost:3001/processed/${mergeData.outputFile.split('/').pop()}`);
    } else {
      setStatus('Merge failed.');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 bg-white rounded-xl shadow space-y-6">
      <h2 className="text-xl font-bold mb-4">Merge Multiple Videos</h2>
      <input
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileChange}
        className="mb-4"
      />
      {files.length > 0 && (
        <ul className="mb-4 space-y-2">
          {files.map((file, idx) => (
            <li key={idx} className="flex items-center justify-between bg-gray-100 p-2 rounded">
              <span>{file.name}</span>
              <button
                className="text-red-500 hover:underline"
                onClick={() => handleRemove(idx)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        onClick={handleMerge}
        disabled={files.length < 2}
      >
        Merge Videos
      </button>
      {status && <div className="mt-4 text-sm">{status}</div>}
      {downloadUrl && (
        <a
          href={downloadUrl}
          className="block mt-4 text-blue-600 underline"
          download
        >
          Download Merged Video
        </a>
      )}
    </div>
  );
} 