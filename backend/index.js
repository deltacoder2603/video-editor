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

let customProfanityList = new Set();
let videoSessions = new Map();
let editHistory = new Map();

const englishProfanity = [
  "damn", "hell", "crap", "piss", "ass", "bitch", "bastard", "shit", "fuck", 
  "fucking", "motherfucker", "cocksucker", "dickhead", "asshole", "bullshit", 
  "dumbass", "jackass", "smartass", "cunt", "whore", "slut", "faggot", "nigger", 
  "retard", "goddamn", "jesus christ", "holy shit", "god damn", "dick", "cock", 
  "pussy", "tits", "boobs", "balls", "wtf", "stfu", "gtfo", "omfg", "fml",
  "f*ck", "f**k", "sh*t", "b*tch", "a**hole", "d*mn"
];

const hindiProfanity = [
  "चूतिया", "मादरचोद", "बहनचोद", "भोसड़ीके", "रंडी", "हरामी", "कमीना", 
  "कुत्ता", "कुत्ती", "साला", "साली", "गांडू", "लंड", "लौड़ा", "भोसड़ा", 
  "चूत", "गांड", "बहन की चूत", "मां की चूत", "तेरी मां", "चिनाल", "पटाका", 
  "हिजड़ा", "चक्का", "आइटम", "रांड", "भड़वा", "दलाल", "चिनल", "कमीनी", 
  "हरामखोर", "नाजायज", "बदमाश", "गुंडा", "लफंगा", "कुत्ते", "सुअर", 
  "कमीने", "हरामजादे", "बेशर्म", "निकम्मा", "बेवकूफ", "गधा", "उल्लू"
];

function getAllProfanityWords(customWords = []) {
  return new Set([
    ...englishProfanity.map(w => w.toLowerCase()),
    ...hindiProfanity.map(w => w.toLowerCase()),
    ...Array.from(customProfanityList),
    ...customWords.map(w => w.toLowerCase())
  ]);
}

const logProgress = (emoji, message, data = null) => {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log(`${emoji} [${timestamp}] ${message}`);
  if (data) console.log(`   📊 Data:`, data);
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
    if (mimetype && extname) return cb(null, true);
    cb(new Error('Only video files are allowed'));
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
      if (timestamp && text) {
        const [start, end] = timestamp.split(' --> ');
        entries.push({ 
          index: parseInt(lines[i]),
          start, 
          end, 
          text,
          startSeconds: srtTimeToSeconds(start),
          endSeconds: srtTimeToSeconds(end)
        });
      }
      i += 4;
    } else {
      i++;
    }
  }
  logProgress('✅', `SRT parsing completed - Found ${entries.length} subtitle entries`);
  return entries;
}

function findProfanityTimestamps(entries, lang = 'hi', customWords = []) {
  logProgress('🔍', `Scanning for profanity in ${entries.length} subtitle entries`);
  const profaneTimestamps = [];
  const detectedWords = [];
  let profaneCount = 0;
  
  const allProfanity = getAllProfanityWords(customWords);
  
  for (const entry of entries) {
    const words = entry.text.split(' ');
    const highlightedWords = [];
    let hasProfanity = false;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordLower = word.toLowerCase();
      const filtered = filterBadWords(word, lang);
      
      const isProfane = allProfanity.has(wordLower) || filtered !== word;
      
      if (isProfane) {
        highlightedWords.push({
          word,
          index: i,
          isProfane: true,
          detectedBy: filtered !== word ? 'filter' : 'list'
        });
        detectedWords.push({ word, timestamp: entry.start, sentence: entry.text });
        hasProfanity = true;
      } else {
        highlightedWords.push({ word, index: i, isProfane: false });
      }
    }
    
    if (hasProfanity) {
      profaneCount++;
      profaneTimestamps.push({ 
        start: entry.startSeconds, 
        end: entry.endSeconds,
        text: entry.text,
        highlightedWords,
        index: entry.index
      });
    }
  }
  
  logProgress('📊', `Profanity scan completed - Found ${profaneCount} profane segments`);
  return { segments: profaneTimestamps, detectedWords };
}

async function extractAudio(inputPath, outputPath) {
  logProgress('🎵', 'Starting audio extraction');
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

async function transcribeAudio(audioPath, tempDir, language = 'hi', model = 'large') {
  logProgress('🎙️', `Starting audio transcription with Whisper model: ${model}`);
  return new Promise((resolve, reject) => {
    exec(
      `whisper "${audioPath}" --language ${language} --task transcribe --output_format json --word_timestamps True --output_dir "${tempDir}" --model ${model}`,
      (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });
}

async function muteProfanitySegments(inputPath, outputPath, segments) {
  logProgress('🔇', 'Starting profanity muting process');
  return new Promise((resolve, reject) => {
    if (segments.length === 0) {
      ffmpeg(inputPath)
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', () => resolve({ filename: path.basename(outputPath) }))
        .on('error', reject)
        .run();
      return;
    }
    
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
      .on('end', () => resolve({ filename: path.basename(outputPath) }))
      .on('error', reject)
      .run();
  });
}

async function parseWhisperJson(jsonPath) {
  logProgress('📄', 'Parsing Whisper JSON file', { path: jsonPath });
  const data = await fs.readFile(jsonPath, 'utf8');
  const json = JSON.parse(data);
  const entries = [];
  let index = 1;
  for (const segment of json.segments) {
    entries.push({
      index: index++,
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
      startSeconds: segment.start,
      endSeconds: segment.end,
      words: segment.words?.map(w => ({
        word: w.word.trim(),
        start: w.start,
        end: w.end
      })) || []
    });
  }
  logProgress('✅', `Whisper JSON parsing completed - Found ${entries.length} segments`);
  return entries;
}

app.post('/api/session/create', async (req, res) => {
  try {
    const sessionId = uuidv4();
    videoSessions.set(sessionId, {
      id: sessionId,
      videos: [],
      createdAt: new Date(),
      currentVersion: 0
    });
    editHistory.set(sessionId, []);
    
    res.json({ success: true, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload-multiple', upload.array('videos', 10), async (req, res) => {
  const { sessionId } = req.body;
  logProgress('📤', 'Processing multiple file uploads');
  
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const session = videoSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const uploadedFiles = [];
    for (const file of req.files) {
      const fileInfo = {
        id: path.parse(file.filename).name,
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        path: file.path,
        uploadedAt: new Date()
      };
      
      const videoInfo = await getVideoInfo(file.path);
      uploadedFiles.push({ ...fileInfo, videoInfo });
      session.videos.push(fileInfo);
    }
    
    res.json({ success: true, files: uploadedFiles, sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/upload', upload.single('video'), async (req, res) => {
  logProgress('📤', 'Processing file upload');
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileInfo = {
      id: path.parse(req.file.filename).name,
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date()
    };

    const videoInfo = await getVideoInfo(req.file.path);
    res.json({ success: true, file: fileInfo, videoInfo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transcribe', async (req, res) => {
  const { fileId, language = 'hi' } = req.body;
  logProgress('🚀', 'Starting transcription process');
  try {
    const inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const tempDir = path.join(__dirname, 'temp');
    const audioPath = path.join(tempDir, `${fileId}_audio.wav`);
    const jsonPath = path.join(tempDir, `${fileId}_audio.json`);

    await fs.mkdir(tempDir, { recursive: true });
    await extractAudio(inputPath, audioPath);
    await transcribeAudio(audioPath, tempDir, language, 'large');

    const entries = await parseWhisperJson(jsonPath);

    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(jsonPath).catch(() => {});

    res.json({ success: true, transcript: entries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/detect-profanity', async (req, res) => {
  const { fileId, language = 'hi', customWords = [] } = req.body;
  logProgress('🚀', 'Starting profanity detection process');
  try {
    const inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    const tempDir = path.join(__dirname, 'temp');
    const audioPath = path.join(tempDir, `${fileId}_audio.wav`);
    const jsonPath = path.join(tempDir, `${fileId}_audio.json`);

    await fs.mkdir(tempDir, { recursive: true });
    await extractAudio(inputPath, audioPath);
    await transcribeAudio(audioPath, tempDir, language, 'large');

    const entries = await parseWhisperJson(jsonPath);
    const result = findProfanityTimestamps(entries, language, customWords);

    await fs.unlink(audioPath).catch(() => {});
    await fs.unlink(jsonPath).catch(() => {});

    res.json({
      success: true,
      transcript: entries,
      profanityData: result,
      totalSegments: result.segments.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/custom-profanity/add', async (req, res) => {
  const { words } = req.body;
  try {
    words.forEach(word => customProfanityList.add(word.toLowerCase()));
    res.json({ success: true, totalCustomWords: customProfanityList.size });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/custom-profanity', async (req, res) => {
  try {
    res.json({ success: true, words: Array.from(customProfanityList) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/profanity', async (req, res) => {
  const { fileId, segments, language = 'hi', selectedWords = [], sessionId, sourceVersion = 'original' } = req.body;
  logProgress('🚀', 'Starting profanity processing');
  
  try {
    const session = videoSessions.get(sessionId);
    let inputPath;
    
    if (sourceVersion === 'original') {
      inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    } else {
      const history = editHistory.get(sessionId) || [];
      const versionEntry = history.find(h => h.version === parseInt(sourceVersion));
      if (!versionEntry) {
        return res.status(404).json({ error: 'Version not found' });
      }
      inputPath = path.join(__dirname, 'processed', versionEntry.filename);
    }
    
    const outputPath = path.join(__dirname, 'processed', `${fileId}_v${session.currentVersion + 1}_profanity_filtered.mp4`);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    selectedWords.forEach(word => customProfanityList.add(word.toLowerCase()));
    
    let finalSegments = segments;
    if (!segments || segments.length === 0) {
      const tempDir = path.join(__dirname, 'temp');
      const audioPath = path.join(tempDir, `${fileId}_audio.wav`);
      const jsonPath = path.join(tempDir, `${fileId}_audio.json`);
      
      await fs.mkdir(tempDir, { recursive: true });
      await extractAudio(inputPath, audioPath);
      await transcribeAudio(audioPath, tempDir, language, 'large');
      
      const entries = await parseWhisperJson(jsonPath);
      const result = findProfanityTimestamps(entries, language, selectedWords);
      finalSegments = result.segments;
      
      await fs.unlink(audioPath).catch(() => {});
      await fs.unlink(jsonPath).catch(() => {});
    }
    
    const result = await muteProfanitySegments(inputPath, outputPath, finalSegments);
    
    session.currentVersion++;
    const editEntry = {
      version: session.currentVersion,
      type: 'profanity_filter',
      filename: result.filename,
      sourceVersion,
      timestamp: new Date(),
      segmentsMuted: finalSegments.length,
      selectedWords
    };
    
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    
    // Parse the transcript from Whisper JSON (or reuse the one you already have)
    const tempDir = path.join(__dirname, 'temp');
    const jsonPath = path.join(tempDir, `${fileId}_audio.json`);
    let transcript = [];
    try {
      transcript = await parseWhisperJson(jsonPath);
    } catch (e) {
      transcript = [];
    }
    
    res.json({
      success: true,
      outputFile: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      version: session.currentVersion,
      segmentsMuted: finalSegments.length,
      transcript,
      profanityData: { segments: finalSegments }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/multi-trim-join', async (req, res) => {
  const { sessionId, videoSegments, outputName } = req.body;
  logProgress('🚀', 'Starting multi-video trim and join');
  
  try {
    const session = videoSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    // Validate videoSegments
    if (!Array.isArray(videoSegments) || videoSegments.length === 0) {
      return res.status(400).json({ error: 'No video segments provided' });
    }
    for (const videoSeg of videoSegments) {
      if (!videoSeg.videoId || !Array.isArray(videoSeg.segments) || videoSeg.segments.length === 0) {
        return res.status(400).json({ error: 'Malformed videoSegments: each entry must have videoId and non-empty segments array' });
      }
      for (const segment of videoSeg.segments) {
        if (typeof segment.start !== 'number' || typeof segment.end !== 'number' || segment.start >= segment.end) {
          return res.status(400).json({ error: 'Malformed segment: start and end must be numbers and start < end' });
        }
      }
    }
    
    const outputPath = path.join(__dirname, 'processed', `${outputName || 'multi_video_joined'}_v${session.currentVersion + 1}.mp4`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    
    let filterComplex = '';
    let concatInputs = '';
    const inputFiles = [];
    
    videoSegments.forEach((videoSeg, videoIndex) => {
      const video = session.videos.find(v => v.id === videoSeg.videoId);
      if (!video) throw new Error(`Video ${videoSeg.videoId} not found in session`);
      inputFiles.push(video.path);
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
    
    // Log filterComplex and input files for debugging
    logProgress('🛠️', 'FFmpeg filterComplex', { filterComplex });
    logProgress('🗂️', 'FFmpeg input files', { inputFiles });
    
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
    
    session.currentVersion++;
    const editEntry = {
      version: session.currentVersion,
      type: 'multi_trim_join',
      filename: path.basename(outputPath),
      sourceVersion: 'multiple',
      timestamp: new Date(),
      videoSegments
    };
    
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    
    res.json({
      success: true,
      outputFile: path.basename(outputPath),
      downloadUrl: `/api/download/${path.basename(outputPath)}`,
      version: session.currentVersion
    });
  } catch (error) {
    logProgress('❌', 'Multi-video processing error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/session/:sessionId/history', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const session = videoSessions.get(sessionId);
    const history = editHistory.get(sessionId) || [];
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      success: true,
      session,
      history,
      availableVersions: ['original', ...history.map(h => h.version.toString())]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/audio-remove', async (req, res) => {
  const { fileId, segments, sessionId, sourceVersion = 'original' } = req.body;
  logProgress('🚀', 'Starting audio removal process');
  
  try {
    const session = videoSessions.get(sessionId);
    let inputPath;
    
    if (sourceVersion === 'original') {
      inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    } else {
      const history = editHistory.get(sessionId) || [];
      const versionEntry = history.find(h => h.version === parseInt(sourceVersion));
      if (!versionEntry) {
        return res.status(404).json({ error: 'Version not found' });
      }
      inputPath = path.join(__dirname, 'processed', versionEntry.filename);
    }
    
    const outputPath = path.join(__dirname, 'processed', `${fileId}_v${session.currentVersion + 1}_audio_removed.mp4`);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await removeAudioFromSegments(inputPath, outputPath, segments);
    
    session.currentVersion++;
    const editEntry = {
      version: session.currentVersion,
      type: 'audio_removal',
      filename: result.filename,
      sourceVersion,
      timestamp: new Date(),
      segments
    };
    
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    
    res.json({
      success: true,
      outputFile: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      version: session.currentVersion
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/process/trim', async (req, res) => {
  const { fileId, segments, joinSegments, sessionId, sourceVersion = 'original' } = req.body;
  logProgress('🚀', 'Starting video trimming process');
  
  try {
    const session = videoSessions.get(sessionId);
    let inputPath;
    
    if (sourceVersion === 'original') {
      inputPath = path.join(__dirname, 'uploads', `${fileId}.mp4`);
    } else {
      const history = editHistory.get(sessionId) || [];
      const versionEntry = history.find(h => h.version === parseInt(sourceVersion));
      if (!versionEntry) {
        return res.status(404).json({ error: 'Version not found' });
      }
      inputPath = path.join(__dirname, 'processed', versionEntry.filename);
    }
    
    const outputPath = path.join(__dirname, 'processed', `${fileId}_v${session.currentVersion + 1}_trimmed.mp4`);
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await trimVideo(inputPath, outputPath, segments, joinSegments);
    
    session.currentVersion++;
    const editEntry = {
      version: session.currentVersion,
      type: 'trim',
      filename: result.filename,
      sourceVersion,
      timestamp: new Date(),
      segments,
      joinSegments
    };
    
    const history = editHistory.get(sessionId) || [];
    history.push(editEntry);
    editHistory.set(sessionId, history);
    
    res.json({
      success: true,
      outputFile: result.filename,
      downloadUrl: `/api/download/${result.filename}`,
      version: session.currentVersion
    });
  } catch (error) {
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
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.download(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  logProgress('🗑️', 'Starting session cleanup');
  
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

async function removeAudioFromSegments(inputPath, outputPath, segments) {
  return new Promise((resolve, reject) => {
    let filter = '[0:a]';
    
    if (segments && segments.length > 0) {
      const volumeConditions = segments.map(({ start, end }) => 
        `between(t,${start},${end})`
      ).join('+');
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

app.listen(PORT, () => {
  logProgress('🚀', `Server started successfully on port ${PORT}`);
  logProgress('🌟', 'Enhanced video processing server ready!');
});
