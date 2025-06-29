const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { filterBadWords } = require('@tekdi/multilingual-profanity-filter');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Progress logging utility
const logProgress = (emoji, message, data = null) => {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`${emoji} [${timestamp}] ${message}`);
  if (data) {
    console.log(`   📊 Data:`, data);
  }
};

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
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

function srtTimeToSeconds(srtTime) {
  const [h, m, rest] = srtTime.split(':');
  const [s, ms] = rest.split(',');
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
}

async function parseSRT(srtPath) {
  logProgress('📄', 'Parsing SRT file', { path: srtPath });
  const srt = await fs.readFile(srtPath, 'utf8');
  const lines = srt.split('\n');
  const entries = [];
  let i = 0;
  while (i < lines.length) {
    if (/^\d+$/.test(lines[i])) {
      const timestamp = lines[i + 1];
      const text = lines[i + 2];
      const [start, end] = timestamp.split(' --> ');
      entries.push({ start, end, text });
      i += 4;
    } else {
      i++;
    }
  }
  logProgress('✅', `SRT parsing completed - Found ${entries.length} subtitle entries`);
  return entries;
}

function findProfanityTimestamps(entries, lang = 'hi') {
  logProgress('🔍', `Scanning for profanity in ${entries.length} subtitle entries`, { language: lang });
  const profaneTimestamps = [];
  let profaneCount = 0;
  
  for (const entry of entries) {
    const filtered = filterBadWords(entry.text, lang);
    if (filtered !== entry.text) {
      profaneCount++;
      profaneTimestamps.push({ 
        start: srtTimeToSeconds(entry.start), 
        end: srtTimeToSeconds(entry.end) 
      });
      logProgress('🚨', `Profanity detected at ${entry.start} - ${entry.end}`, { original: entry.text, filtered });
    }
  }
  
  logProgress('📊', `Profanity scan completed - Found ${profaneCount} profane segments out of ${entries.length} entries`);
  return profaneTimestamps;
}

async function extractAudio(inputPath, outputPath) {
  logProgress('🎵', 'Starting audio extraction', { input: path.basename(inputPath), output: path.basename(outputPath) });
  
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .output(outputPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .on('start', (commandLine) => {
        logProgress('⚡', 'FFmpeg audio extraction started', { command: commandLine });
      })
      .on('progress', (progress) => {
        logProgress('📈', `Audio extraction progress: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        logProgress('✅', 'Audio extraction completed successfully');
        resolve();
      })
      .on('error', (err) => {
        logProgress('❌', 'Audio extraction failed', { error: err.message });
        reject(err);
      })
      .run();
  });
}

async function transcribeAudio(audioPath, tempDir, language = 'hi') {
  logProgress('🎙️', 'Starting audio transcription with Whisper', { 
    audio: path.basename(audioPath), 
    language, 
    outputDir: tempDir 
  });
  
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    exec(
      `whisper "${audioPath}" --language ${language} --task transcribe --output_format srt --output_dir "${tempDir}"`,
      (error, stdout, stderr) => {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        if (error) {
          logProgress('❌', `Whisper transcription failed after ${duration}s`, { error: error.message });
          return reject(error);
        }
        
        logProgress('✅', `Whisper transcription completed in ${duration}s`);
        if (stdout) logProgress('📝', 'Whisper stdout', { output: stdout.slice(0, 200) + '...' });
        resolve();
      }
    );
  });
}

async function muteProfanitySegments(inputPath, outputPath, segments) {
  logProgress('🔇', 'Starting profanity muting process', { 
    input: path.basename(inputPath), 
    output: path.basename(outputPath),
    segmentsToMute: segments.length 
  });
  
  return new Promise((resolve, reject) => {
    if (segments.length === 0) {
      logProgress('ℹ️', 'No profanity segments found - copying file as-is');
      ffmpeg(inputPath)
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('start', (commandLine) => {
          logProgress('⚡', 'FFmpeg copy started', { command: commandLine });
        })
        .on('end', () => {
          logProgress('✅', 'File copy completed');
          resolve({ filename: path.basename(outputPath) });
        })
        .on('error', (err) => {
          logProgress('❌', 'File copy failed', { error: err.message });
          reject(err);
        })
        .run();
      return;
    }
    
    logProgress('🔧', 'Building audio filter for profanity muting', { segments });
    let audioFilter = '[0:a]';
    const volumeFilters = segments.map(({ start, end }) => 
      `volume=enable='between(t,${start},${end})':volume=0`
    );
    audioFilter += volumeFilters.join(',') + '[outa]';
    
    ffmpeg(inputPath)
      .outputOptions([
        '-filter_complex', audioFilter,
        '-map', '0:v',
        '-map', '[outa]',
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-movflags', '+faststart'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        logProgress('⚡', 'FFmpeg profanity muting started', { command: commandLine });
      })
      .on('progress', (progress) => {
        logProgress('📈', `Profanity muting progress: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        logProgress('✅', `Profanity muting completed - ${segments.length} segments muted`);
        resolve({ filename: path.basename(outputPath) });
      })
      .on('error', (err) => {
        logProgress('❌', 'Profanity muting failed', { error: err.message });
        reject(err);
      })
      .run();
  });
}

app.post('/api/detect-profanity', async (req, res) => {
  const { fileId, language = 'hi' } = req.body;
  logProgress('🚀', 'Starting profanity detection process', { fileId, language });
  
  try {
    const inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const tempDir = path.join(__dirname, 'temp');
    const audioPath = path.join(tempDir, `${fileId}_audio.wav`);
    const srtPath = path.join(tempDir, `${fileId}_audio.srt`);
    
    logProgress('📁', 'Creating temporary directory', { tempDir });
    await fs.mkdir(tempDir, { recursive: true });
    
    await extractAudio(inputPath, audioPath);
    await transcribeAudio(audioPath, tempDir, language);
    
    const entries = await parseSRT(srtPath);
    const segments = findProfanityTimestamps(entries, language);
    
    logProgress('🧹', 'Cleaning up temporary files');
    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(srtPath).catch(() => {});
    
    const totalDuration = segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    logProgress('🎯', 'Profanity detection completed', { 
      segmentsFound: segments.length,
      totalDurationToMute: `${totalDuration.toFixed(2)}s`
    });
    
    res.json({
      success: true,
      segments,
      profanityCount: segments.length,
      totalDuration
    });
  } catch (error) {
    logProgress('💥', 'Profanity detection error', { error: error.message });
    console.error('Profanity detection error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/profanity', async (req, res) => {
  const { fileId, segments, language = 'hi' } = req.body;
  logProgress('🚀', 'Starting profanity processing', { fileId, providedSegments: segments?.length || 0, language });
  
  try {
    const inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const outputPath = path.join(__dirname, 'processed', `${fileId}_profanity_filtered.mp4`);
    
    logProgress('📁', 'Creating processed directory');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    let finalSegments = segments;
    
    if (!segments || segments.length === 0) {
      logProgress('🔍', 'No segments provided - performing automatic detection');
      const tempDir = path.join(__dirname, 'temp');
      const audioPath = path.join(tempDir, `${fileId}_audio.wav`);
      const srtPath = path.join(tempDir, `${fileId}_audio.srt`);
      
      await fs.mkdir(tempDir, { recursive: true });
      await extractAudio(inputPath, audioPath);
      await transcribeAudio(audioPath, tempDir, language);
      
      const entries = await parseSRT(srtPath);
      finalSegments = findProfanityTimestamps(entries, language);
      
      logProgress('🧹', 'Cleaning up temporary files');
      await fs.unlink(audioPath).catch(() => {});
      await fs.unlink(srtPath).catch(() => {});
    }
    
    const result = await muteProfanitySegments(inputPath, outputPath, finalSegments);
    
    logProgress('🎉', 'Profanity processing completed successfully', {
      outputFile: result.filename,
      segmentsMuted: finalSegments.length
    });
    
    res.json({
      success: true,
      outputFile: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      segmentsMuted: finalSegments.length
    });
  } catch (error) {
    logProgress('💥', 'Profanity processing error', { error: error.message });
    console.error('Profanity processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  logProgress('📤', 'Processing file upload');
  
  try {
    if (!req.file) {
      logProgress('❌', 'Upload failed - No file provided');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    logProgress('📋', 'File uploaded successfully', {
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: `${(req.file.size / (1024 * 1024)).toFixed(2)} MB`
    });

    const fileInfo = {
      id: path.parse(req.file.filename).name,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date()
    };

    logProgress('🔍', 'Analyzing video metadata');
    const videoInfo = await getVideoInfo(req.file.path);
    logProgress('✅', 'Video analysis completed', videoInfo);
    
    res.json({
      success: true,
      file: fileInfo,
      videoInfo
    });
  } catch (error) {
    logProgress('💥', 'Upload processing error', { error: error.message });
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/audio-remove', async (req, res) => {
  const { fileId, segments } = req.body;
  logProgress('🚀', 'Starting audio removal process', { fileId, segments: segments?.length || 0 });
  
  try {
    const inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const outputPath = path.join(__dirname, 'processed', `${fileId}_audio_removed.mp4`);
    
    logProgress('📁', 'Creating processed directory');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await removeAudioFromSegments(inputPath, outputPath, segments);
    
    logProgress('🎉', 'Audio removal completed successfully', { outputFile: result.filename });
    
    res.json({
      success: true,
      outputFile: result.filename,
      downloadUrl: `/api/download/${result.filename}`
    });
  } catch (error) {
    logProgress('💥', 'Audio removal error', { error: error.message });
    console.error('Audio removal error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/trim', async (req, res) => {
  const { fileId, segments, joinSegments } = req.body;
  logProgress('🚀', 'Starting video trimming process', { 
    fileId, 
    segments: segments?.length || 0, 
    joinSegments 
  });
  
  try {
    const inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const outputPath = path.join(__dirname, 'processed', `${fileId}_trimmed.mp4`);
    
    logProgress('📁', 'Creating processed directory');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await trimVideo(inputPath, outputPath, segments, joinSegments);
    
    logProgress('🎉', 'Video trimming completed successfully', { outputFile: result.filename });
    
    res.json({
      success: true,
      outputFile: result.filename,
      downloadUrl: `/api/download/${result.filename}`
    });
  } catch (error) {
    logProgress('💥', 'Video trimming error', { error: error.message });
    console.error('Trim error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/download/:filename', async (req, res) => {
  const filename = req.params.filename;
  logProgress('📥', 'Download request received', { filename });
  
  try {
    const filePath = path.join(__dirname, 'processed', filename);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    
    if (!exists) {
      logProgress('❌', 'Download failed - File not found', { filename });
      return res.status(404).json({ error: 'File not found' });
    }
    
    logProgress('✅', 'Starting file download', { filename });
    res.download(filePath);
  } catch (error) {
    logProgress('💥', 'Download error', { filename, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/files/:fileId', async (req, res) => {
  const fileId = req.params.fileId;
  logProgress('🗑️', 'Starting file cleanup', { fileId });
  
  try {
    const uploadPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const processedDir = path.join(__dirname, 'processed');
    
    logProgress('🧹', 'Removing upload file');
    await fs.unlink(uploadPath).catch(() => {});
    
    logProgress('🧹', 'Scanning for processed files to remove');
    const processedFiles = await fs.readdir(processedDir);
    let removedCount = 0;
    
    for (const file of processedFiles) {
      if (file.includes(fileId)) {
        await fs.unlink(path.join(processedDir, file)).catch(() => {});
        removedCount++;
        logProgress('🗑️', `Removed processed file: ${file}`);
      }
    }
    
    logProgress('✅', `File cleanup completed - Removed ${removedCount + 1} files`);
    res.json({ success: true });
  } catch (error) {
    logProgress('💥', 'File cleanup error', { fileId, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

async function getVideoInfo(filePath) {
  logProgress('🔍', 'Analyzing video file', { path: path.basename(filePath) });
  
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        logProgress('❌', 'Video analysis failed', { error: err.message });
        return reject(err);
      }
      
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      
      const info = {
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
      };
      
      logProgress('✅', 'Video analysis completed', {
        duration: `${Math.round(info.duration)}s`,
        resolution: info.video.resolution,
        format: info.format
      });
      
      resolve(info);
    });
  });
}

async function removeAudioFromSegments(inputPath, outputPath, segments) {
  logProgress('🔇', 'Starting audio removal from segments', { 
    input: path.basename(inputPath),
    segments: segments?.length || 0
  });
  
  return new Promise((resolve, reject) => {
    let filter = '[0:a]';
    
    if (segments && segments.length > 0) {
      logProgress('🔧', 'Building audio filter for segment removal');
      const volumeConditions = segments.map(({ start, end }) => 
        `between(t,${start},${end})`
      ).join('+');
      
      filter += `volume=enable='${volumeConditions}':volume=0[outa]`;
    } else {
      logProgress('ℹ️', 'No segments specified - copying audio as-is');
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
      .on('start', (commandLine) => {
        logProgress('⚡', 'FFmpeg audio removal started', { command: commandLine });
      })
      .on('progress', (progress) => {
        logProgress('📈', `Audio removal progress: ${Math.round(progress.percent || 0)}%`);
      })
      .on('end', () => {
        logProgress('✅', 'Audio removal completed successfully');
        resolve({ filename: path.basename(outputPath) });
      })
      .on('error', (err) => {
        logProgress('❌', 'Audio removal failed', { error: err.message });
        reject(err);
      })
      .run();
  });
}

async function trimVideo(inputPath, outputPath, segments, joinSegments) {
  logProgress('✂️', 'Starting video trimming', { 
    input: path.basename(inputPath),
    segments: segments?.length || 0,
    joinSegments
  });
  
  return new Promise((resolve, reject) => {
    if (segments.length === 1 && !joinSegments) {
      const { start, end } = segments[0];
      logProgress('🎬', `Trimming single segment: ${start}s to ${end}s (duration: ${end - start}s)`);
      
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
        .on('start', (commandLine) => {
          logProgress('⚡', 'FFmpeg single trim started', { command: commandLine });
        })
        .on('progress', (progress) => {
          logProgress('📈', `Trimming progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          logProgress('✅', 'Single segment trim completed');
          resolve({ filename: path.basename(outputPath) });
        })
        .on('error', (err) => {
          logProgress('❌', 'Single segment trim failed', { error: err.message });
          reject(err);
        })
        .run();
    } else if (joinSegments && segments.length > 1) {
      logProgress('🔗', `Trimming and joining ${segments.length} segments`);
      let filterComplex = '';
      let concatInputs = '';
      
      segments.forEach((segment, i) => {
        const { start, end } = segment;
        logProgress('📝', `Segment ${i + 1}: ${start}s to ${end}s (${end - start}s)`);
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
        .on('start', (commandLine) => {
          logProgress('⚡', 'FFmpeg multi-segment trim started', { command: commandLine });
        })
        .on('progress', (progress) => {
          logProgress('📈', `Multi-segment trimming progress: ${Math.round(progress.percent || 0)}%`);
        })
        .on('end', () => {
          logProgress('✅', `Multi-segment trim completed - ${segments.length} segments joined`);
          resolve({ filename: path.basename(outputPath) });
        })
        .on('error', (err) => {
          logProgress('❌', 'Multi-segment trim failed', { error: err.message });
          reject(err);
        })
        .run();
    } else {
      const error = 'Invalid trim configuration';
      logProgress('❌', error);
      reject(new Error(error));
    }
  });
}

// Server startup
app.listen(PORT, () => {
  logProgress('🚀', `Server started successfully on port ${PORT}`);
  logProgress('🌟', 'Video processing server is ready to handle requests!');
});