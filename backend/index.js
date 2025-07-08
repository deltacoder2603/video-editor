const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
let videoSessions = new Map();
let editHistory = new Map();
let customProfanityList = new Set();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    fs.mkdir(uploadDir, { recursive: true }).then(() => cb(null, uploadDir));
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp)$/i;
    const extname = allowedExtensions.test(file.originalname);
    const allowedMimeTypes = /^video\/(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp|x-msvideo|quicktime)$/i;
    const mimetype = allowedMimeTypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only video files are allowed'));
  }
});

async function convertToMp4(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();
  const outputPath = ext === '.mp4' ? inputPath : inputPath.replace(ext, '.mp4');
  if (ext !== '.mp4') {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-strict', 'experimental',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    await fs.unlink(inputPath).catch(() => {});
  }
  return outputPath;
}

async function getVideoInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      resolve({
        duration: metadata.format.duration,
        size: metadata.format.size,
        format: metadata.format.format_name,
        video: {
          codec: videoStream?.codec_name,
          resolution: `${videoStream?.width}x${videoStream?.height}`,
          fps: videoStream?.r_frame_rate,
          bitrate: videoStream?.bit_rate
        },
        audio: {
          codec: audioStream?.codec_name,
          channels: audioStream?.channels,
          sampleRate: audioStream?.sample_rate
        }
      });
    });
  });
}

async function handleSingleUpload(file) {
  const convertedPath = await convertToMp4(file.path);
  const videoInfo = await getVideoInfo(convertedPath);
  return {
    id: path.parse(convertedPath).name,
    originalName: file.originalname,
    filename: path.basename(convertedPath),
    size: file.size,
    path: convertedPath,
    uploadedAt: new Date(),
    videoInfo
  };
}

app.post('/api/session/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    videoSessions.set(sessionId, { id: sessionId, videos: [], createdAt: new Date(), currentVersion: 0 });
    editHistory.set(sessionId, []);
    res.json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const fileData = await handleSingleUpload(req.file);
    res.json({ success: true, file: fileData, videoInfo: fileData.videoInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-multiple', upload.array('videos', 10), async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    const session = videoSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const uploadedFiles = [];
    for (const file of req.files) {
      const fileData = await handleSingleUpload(file);
      uploadedFiles.push(fileData);
      session.videos.push(fileData);
    }
    res.json({ success: true, files: uploadedFiles, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cleanup', async (req, res) => {
  const dirs = [
    path.join(__dirname, 'processed'),
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'temp'),
  ];
  try {
    for (const dir of dirs) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
      await fs.mkdir(dir, { recursive: true });
    }
    res.json({ success: true, message: 'Cleanup complete.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- RESTORE ALL ADVANCED ENDPOINTS BELOW THIS LINE ---

app.get('/api/session/:sessionId/history', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = videoSessions.get(sessionId);
    const history = editHistory.get(sessionId) || [];
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true, session, history, availableVersions: ['original', ...history.map(h => h.version.toString())] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/:filename', async (req, res) => {
  const filename = req.params.filename;
  try {
    const filePath = path.join(__dirname, 'processed', filename);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) return res.status(404).json({ error: 'File not found' });
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = videoSessions.get(sessionId);
    const history = editHistory.get(sessionId) || [];
    if (session) {
      for (const video of session.videos) {
        await fs.unlink(video.path).catch(() => {});
      }
    }
    for (const edit of history) {
      const filePath = path.join(__dirname, 'processed', edit.filename);
      await fs.unlink(filePath).catch(() => {});
    }
    videoSessions.delete(sessionId);
    editHistory.delete(sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Profanity, audio, trim, merge, and related helpers
function srtTimeToSeconds(srtTime) {
  const [h, m, rest] = srtTime.split(':');
  const [s, ms] = rest.split(',');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

async function extractAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

async function removeAudioFromSegments(inputPath, outputPath, segments) {
  return new Promise((resolve, reject) => {
    let filter = '[0:a]';
    if (segments && segments.length > 0) {
      const volumeConditions = segments.map(({ start, end }) => `between(t,${start},${end})`).join('+');
      filter += `volume=enable='${volumeConditions}':volume=0[outa]`;
    } else {
      filter += 'copy[outa]';
    }
    ffmpeg(inputPath)
      .outputOptions([
        '-filter_complex', filter,
        '-map', '0:v',
        '-map', '[outa]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-movflags', '+faststart'
      ])
      .output(outputPath)
      .on('end', () => resolve({ filename: path.basename(outputPath) }))
      .on('error', reject)
      .run();
  });
}

async function trimVideo(inputPath, outputPath, segments, joinSegments) {
  return new Promise((resolve, reject) => {
    if (segments.length === 1 && !joinSegments) {
      const { start, end } = segments[0];
      ffmpeg(inputPath)
        .outputOptions([
          '-ss', start.toString(),
          '-t', (end - start).toString(),
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve({ filename: path.basename(outputPath) }))
        .on('error', reject)
        .run();
    } else if (joinSegments && segments.length > 1) {
      let filterComplex = '';
      let concatInputs = '';
      segments.forEach((segment, i) => {
        const { start, end } = segment;
        filterComplex += `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${i}];`;
        filterComplex += `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${i}];`;
        concatInputs += `[v${i}][a${i}]`;
      });
      filterComplex += `${concatInputs}concat=n=${segments.length}:v=1:a=1[outv][outa]`;
      ffmpeg(inputPath)
        .outputOptions([
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', () => resolve({ filename: path.basename(outputPath) }))
        .on('error', reject)
        .run();
    } else {
      reject(new Error('Invalid trim configuration'));
    }
  });
}

app.post('/api/process/audio-remove', async (req, res) => {
  const { fileId, segments, sessionId, sourceVersion = 'original' } = req.body;
  try {
    const session = videoSessions.get(sessionId);
    let inputPath;
    if (sourceVersion === 'original') {
      inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    } else {
      const history = editHistory.get(sessionId) || [];
      const versionEntry = history.find(h => h.version === parseInt(sourceVersion));
      if (!versionEntry) return res.status(404).json({ error: 'Version not found' });
      inputPath = path.join(__dirname, 'processed', versionEntry.filename);
    }
    const outputPath = path.join(__dirname, 'processed', `${fileId}_v${session.currentVersion + 1}_audio_removed.mp4`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await removeAudioFromSegments(inputPath, outputPath, segments);
    session.currentVersion++;
    const editEntry = { version: session.currentVersion, type: 'audio_removal', filename: result.filename, sourceVersion, timestamp: new Date(), segments };
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    res.json({ success: true, outputFile: result.filename, downloadUrl: `/api/download/${result.filename}`, version: session.currentVersion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/trim', async (req, res) => {
  const { fileId, segments, joinSegments, sessionId, sourceVersion = 'original' } = req.body;
  try {
    const session = videoSessions.get(sessionId);
    let inputPath;
    if (sourceVersion === 'original') {
      inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    } else {
      const history = editHistory.get(sessionId) || [];
      const versionEntry = history.find(h => h.version === parseInt(sourceVersion));
      if (!versionEntry) return res.status(404).json({ error: 'Version not found' });
      inputPath = path.join(__dirname, 'processed', versionEntry.filename);
    }
    const outputPath = path.join(__dirname, 'processed', `${fileId}_v${session.currentVersion + 1}_trimmed.mp4`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await trimVideo(inputPath, outputPath, segments, joinSegments);
    session.currentVersion++;
    const editEntry = { version: session.currentVersion, type: 'trim', filename: result.filename, sourceVersion, timestamp: new Date(), segments, joinSegments };
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    res.json({ success: true, outputFile: result.filename, downloadUrl: `/api/download/${result.filename}`, version: session.currentVersion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function ensureMp4H264Aac(inputPath, tempDir, index) {
  const outputPath = path.join(tempDir, `input_${index}_${path.basename(inputPath, path.extname(inputPath))}.mp4`);
  await new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
        '-r', '30',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart'
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
  return outputPath;
}

app.post('/api/process/multi-trim-join', async (req, res) => {
  const { sessionId, videoSegments, outputName } = req.body;
  try {
    const session = videoSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!Array.isArray(videoSegments) || videoSegments.length === 0) return res.status(400).json({ error: 'No video segments provided' });
    for (const videoSeg of videoSegments) {
      if (!videoSeg.videoId || !Array.isArray(videoSeg.segments) || videoSeg.segments.length === 0) return res.status(400).json({ error: 'Malformed videoSegments: each entry must have videoId and non-empty segments array' });
      for (const segment of videoSeg.segments) {
        if (typeof segment.start !== 'number' || typeof segment.end !== 'number' || segment.start >= segment.end) return res.status(400).json({ error: 'Malformed segment: start and end must be numbers and start < end' });
      }
    }
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    let filterComplex = '';
    let concatInputs = '';
    const inputFiles = [];
    // Convert all input files to MP4 H.264/AAC
    for (let videoIndex = 0; videoIndex < videoSegments.length; videoIndex++) {
      const videoSeg = videoSegments[videoIndex];
      const video = session.videos.find(v => v.id === videoSeg.videoId);
      if (!video) throw new Error(`Video ${videoSeg.videoId} not found in session`);
      const convertedPath = await ensureMp4H264Aac(video.path, tempDir, videoIndex);
      inputFiles.push(convertedPath);
    }
    videoSegments.forEach((videoSeg, videoIndex) => {
      videoSeg.segments.forEach((segment, segIndex) => {
        const { start, end } = segment;
        const labelIndex = `${videoIndex}_${segIndex}`;
        filterComplex += `[${videoIndex}:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${labelIndex}];`;
        filterComplex += `[${videoIndex}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS[a${labelIndex}];`;
        concatInputs += `[v${labelIndex}][a${labelIndex}]`;
      });
    });
    const totalSegments = videoSegments.reduce((sum, vs) => sum + vs.segments.length, 0);
    filterComplex += `${concatInputs}concat=n=${totalSegments}:v=1:a=1[outv][outa]`;
    const outputPath = path.join(__dirname, 'processed', `${outputName || 'multi_video_joined'}_v${session.currentVersion + 1}.mp4`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const command = ffmpeg();
    inputFiles.forEach(file => command.input(file));
    await new Promise((resolve, reject) => {
      command
        .outputOptions([
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-c:a', 'aac',
          '-movflags', '+faststart'
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    // Clean up temp files
    for (const file of inputFiles) {
      await fs.unlink(file).catch(() => {});
    }
    session.currentVersion++;
    const editEntry = { version: session.currentVersion, type: 'multi_trim_join', filename: path.basename(outputPath), sourceVersion: 'multiple', timestamp: new Date(), videoSegments };
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    res.json({ success: true, outputFile: path.basename(outputPath), downloadUrl: `/api/download/${path.basename(outputPath)}`, version: session.currentVersion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/merge-multiple', async (req, res) => {
  const { videoPaths, outputName = 'merged_video.mp4' } = req.body;
  if (!Array.isArray(videoPaths) || videoPaths.length < 2) return res.status(400).json({ error: 'Provide at least two video paths.' });
  try {
    const tempDir = path.join(__dirname, 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    let convertedPaths = [];
    for (let i = 0; i < videoPaths.length; i++) {
      const converted = await ensureMp4H264Aac(videoPaths[i], tempDir, i);
      convertedPaths.push(converted);
    }
    let currentOutput = convertedPaths[0];
    let tempFiles = [];
    for (let i = 1; i < convertedPaths.length; i++) {
      const nextVideo = convertedPaths[i];
      const tempOutput = path.join(tempDir, `merge_temp_${i}.mp4`);
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(currentOutput)
          .input(nextVideo)
          .on('end', resolve)
          .on('error', reject)
          .mergeToFile(tempOutput, tempDir);
      });
      if (i > 1 && tempFiles.length > 0) {
        await fs.unlink(currentOutput).catch(() => {});
      }
      tempFiles.push(tempOutput);
      currentOutput = tempOutput;
    }
    const finalOutput = path.join(__dirname, 'processed', outputName);
    await fs.mkdir(path.dirname(finalOutput), { recursive: true });
    await fs.rename(currentOutput, finalOutput);
    // Clean up temp files
    for (const file of tempFiles) {
      if (file !== finalOutput) {
        await fs.unlink(file).catch(() => {});
      }
    }
    for (const file of convertedPaths) {
      await fs.unlink(file).catch(() => {});
    }
    res.json({ success: true, outputFile: finalOutput });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
