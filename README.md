# Video Editor - AI-Powered Video Processing Platform

A modern, full-stack video editing application that combines the power of FFmpeg with AI-driven profanity detection and audio processing. Built with Next.js, Express.js, and advanced video processing capabilities.

## 🎬 Features

### Core Video Processing
- **Audio Removal**: Remove audio from specific video segments
- **Video Trimming**: Cut and trim video segments with precision
- **Profanity Detection & Muting**: AI-powered profanity detection with automatic audio muting
- **Multi-format Support**: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP
- **Large File Support**: Handle videos up to 50GB

### AI & Speech Processing
- **Whisper Integration**: Automatic speech-to-text transcription
- **Multilingual Profanity Detection**: Support for Hindi, English, and other languages
- **Confidence-based Filtering**: Adjustable detection sensitivity
- **Custom Profanity Lists**: Add your own words to filter

### User Interface
- **Modern React UI**: Built with shadcn/ui components
- **Drag & Drop Upload**: Intuitive file upload experience
- **Real-time Progress Tracking**: Live progress updates for all operations
- **Video Timeline**: Visual timeline editor for precise segment selection
- **Video Preview**: Real-time preview with seek controls
- **Responsive Design**: Works on desktop and mobile devices

### Advanced Features
- **Batch Processing**: Process multiple segments simultaneously
- **Segment Joining**: Automatically join trimmed segments
- **Profanity Reports**: Detailed analysis of detected profanity
- **File Management**: Automatic cleanup of temporary files
- **Error Handling**: Robust error handling with user-friendly messages

## 🛠️ Technology Stack

### Frontend
- **Next.js 13** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Modern component library
- **Framer Motion** - Smooth animations
- **React Dropzone** - File upload handling
- **React Hook Form** - Form management
- **Zod** - Schema validation

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **FFmpeg** - Video processing engine
- **Multer** - File upload middleware
- **Whisper** - Speech-to-text transcription
- **Multilingual Profanity Filter** - AI-powered content filtering
- **Google Cloud Speech** - Alternative speech recognition

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Nodemon** - Development server
- **UUID** - Unique identifier generation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- FFmpeg installed on your system
- Whisper (OpenAI) for speech transcription
- Google Cloud Speech API (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd video-editor
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**
   
   Create `.env.local` in the frontend directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```
   
   Create `.env` in the backend directory:
   ```env
   PORT=3001
   GOOGLE_CLOUD_SPEECH_API_KEY=your_api_key_here
   ```

5. **Install FFmpeg**
   
   **macOS:**
   ```bash
   brew install ffmpeg
   ```
   
   **Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
   
   **Windows:**
   Download from [FFmpeg official website](https://ffmpeg.org/download.html)

6. **Install Whisper**
   ```bash
   pip install openai-whisper
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The backend will run on `http://localhost:3001`

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on `http://localhost:3000`

3. **Open your browser**
   Navigate to `http://localhost:3000` to access the application

## 📖 Usage Guide

### 1. Upload Video
- Drag and drop your video file or click to browse
- Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV, M4V, 3GP
- Maximum file size: 50GB

### 2. Audio Removal
- Switch to the "Audio Remove" tab
- Use the timeline to select segments where you want to remove audio
- Click "Process" to apply changes

### 3. Video Trimming
- Switch to the "Trim" tab
- Select segments to keep or remove
- Choose whether to join remaining segments
- Click "Process" to trim the video

### 4. Profanity Detection & Muting
- Switch to the "Profanity" tab
- Configure profanity detection settings:
  - Enable/disable AI detection
  - Set confidence threshold
  - Add custom words
  - Choose languages
- Click "Auto Detect" to scan for profanity
- Review the profanity report
- Click "Process" to mute detected segments

### 5. Download
- After processing, click "Download" to save your edited video
- The processed file will be automatically cleaned up after download

## ⚙️ Configuration

### Profanity Detection Settings

- **Use AI**: Enable AI-powered profanity detection
- **Use All Profanity**: Include all detected profanity words
- **API Key**: Google Cloud Speech API key for enhanced detection
- **Custom Words**: Add your own words to the filter list
- **Strict Mode**: Enable stricter filtering
- **Confidence Threshold**: Set detection sensitivity (0.0 - 1.0)
- **Languages**: Select languages for detection (Hindi, English, etc.)

### Processing Options

- **Join Trim Segments**: Automatically join remaining segments after trimming
- **Auto Detect Profanity**: Automatically scan for profanity on upload
- **Use Original for Editing**: Use original video for timeline editing

## 🔧 API Endpoints

### Backend API (`http://localhost:3001`)

- `POST /upload` - Upload video file
- `POST /process/remove-audio` - Remove audio from segments
- `POST /process/trim` - Trim video segments
- `POST /process/profanity` - Detect and mute profanity
- `GET /download/:filename` - Download processed video
- `DELETE /cleanup/:filename` - Clean up temporary files

## 📁 Project Structure

```
video-editor/
├── backend/
│   ├── index.js              # Main server file
│   ├── package.json          # Backend dependencies
│   ├── uploads/              # Uploaded video files
│   ├── processed/            # Processed video files
│   └── temp/                 # Temporary files
├── frontend/
│   ├── app/                  # Next.js app directory
│   │   ├── page.tsx          # Main application page
│   │   ├── layout.tsx        # Root layout
│   │   └── globals.css       # Global styles
│   ├── components/           # React components
│   │   ├── FileUpload.tsx    # File upload component
│   │   ├── VideoPreview.tsx  # Video preview player
│   │   ├── Timeline.tsx      # Timeline editor
│   │   ├── ProcessingProgress.tsx # Progress tracking
│   │   ├── ProfanitySettings.tsx  # Profanity configuration
│   │   ├── ProfanityReport.tsx    # Profanity analysis report
│   │   └── ui/               # shadcn/ui components
│   ├── lib/                  # Utility functions
│   │   ├── api.ts            # API client functions
│   │   └── utils.ts          # Utility functions
│   └── package.json          # Frontend dependencies
└── README.md                 # This file
```

## 🐛 Troubleshooting

### Common Issues

1. **FFmpeg not found**
   - Ensure FFmpeg is installed and accessible in your PATH
   - Restart your terminal after installation

2. **Whisper not working**
   - Install Whisper: `pip install openai-whisper`
   - Ensure Python is in your PATH

3. **Large file upload fails**
   - Check your system's file size limits
   - Ensure sufficient disk space

4. **CORS errors**
   - Verify the backend is running on the correct port
   - Check the `NEXT_PUBLIC_API_URL` environment variable

5. **Video processing fails**
   - Check if the video format is supported
   - Ensure the video file is not corrupted
   - Check FFmpeg installation

### Performance Tips

- Use SSD storage for better I/O performance
- Close other applications during large file processing
- Consider using a more powerful machine for 4K+ videos

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [FFmpeg](https://ffmpeg.org/) - Video processing engine
- [OpenAI Whisper](https://github.com/openai/whisper) - Speech recognition
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the troubleshooting section above
- Review the API documentation

---

**Note**: This application processes video files locally and does not upload content to external servers for privacy and security reasons. 
