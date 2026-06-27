# 🎬 FFmpeg-Free-API — دليل الاستخدام الكامل
## FFmpeg Video Processing + Speech-to-Text + Audio Analysis

> هذا الدليل يشرح **كل ميزة** في المشروع وكيف تستخدمها من n8n أو مباشرة.

---

## 📋 Table of Contents

1. [What Can This API Do?](#-what-can-this-api-do)
2. [Quick Reference — All Endpoints](#-quick-reference--all-endpoints)
3. [Authentication](#-authentication)
4. [Feature 1: FFmpeg Video Processing](#-feature-1-ffmpeg-video-processing)
5. [Feature 2: Speech-to-Text (Transcribe)](#-feature-2-speech-to-text-transcribe)
6. [Feature 3: Audio Probe (Analysis Only)](#-feature-3-audio-probe-analysis-only)
7. [n8n Integration: Syncing Speech to Scenes](#-n8n-integration-syncing-speech-to-scenes)
8. [Real-World Workflows](#-real-world-workflows)
9. [Model Size Guide](#-model-size-guide-for-whisper)
10. [Error Handling & Tips](#-error-handling--tips)

---

## 🚀 What Can This API Do?

```mermaid
flowchart LR
    A[n8n / Your App] --> B[FFmpeg API Server]
    B --> C1[FFmpeg Video Processing]
    B --> C2[Speech-to-Text<br/>Whisper]
    B --> C3[Audio Analysis<br/>FFprobe]
    C1 --> D1[Render videos<br/>Add text/effects<br/>Merge audio/video<br/>Resize/convert]
    C2 --> D2[Transcribe speech<br/>Word timestamps<br/>Speaking rate<br/>Silence gaps]
    C3 --> D3[Audio metadata<br/>Loudness (LUFS)<br/>Silence detection<br/>Estimated WPM]
```

### Three core features:

| # | Feature | Endpoint | What you get | Speed |
|---|---------|----------|-------------|-------|
| 1 | 🎥 **Video Processing** | `POST /v1/render` | Any FFmpeg command, output videos in R2 | ~1-5 min |
| 2 | 🎤 **Speech-to-Text** | `POST /v1/transcribe` | Full transcript with word timestamps, silence gaps, WPM | ~1-5 min |
| 3 | 📊 **Audio Probe** | `POST /v1/audio-probe` | Audio metadata, silence gaps, loudness, estimated WPM | ~10-30 sec |

All outputs are stored in **Cloudflare R2** — you get a public URL back.

---

## 🔌 Quick Reference — All Endpoints

| Method | Endpoint | What it does |
|--------|----------|-------------|
| `GET` | `/` | API info + list of endpoints |
| `GET` | `/health` | Server health + active job count |
| `POST` | `/v1/render` | 🎥 Run any FFmpeg command (main endpoint) |
| `POST` | `/v1/run-ffmpeg-command` | 🎥 Same as render (Rendi.dev compatible) |
| `POST` | `/v1/transcribe` | 🎤 Speech-to-text + full analysis |
| `POST` | `/v1/audio-probe` | 📊 Fast audio analysis only (no STT) |
| `GET` | `/v1/commands/:id` | 🔍 Check job status & get results |
| `POST` | `/v1/commands/:id/check` | 🔍 Force-check a job right now |

### The pattern for every feature is the same:

```
1. POST to get a job → { command_id: "xxx" }
2. Wait ~30-120 seconds
3. GET /v1/commands/xxx  →  { status: "SUCCESS", ...your data }
```

---

## 🔑 Authentication

If you set `API_KEY` in your environment variables, all endpoints require:

```bash
# Header option 1:
x-api-key: your-secret-key

# Header option 2:
Authorization: Bearer your-secret-key
```

If no `API_KEY` is set, all endpoints are public (not recommended for production).

---

## 🎥 Feature 1: FFmpeg Video Processing

### What you can do:
- Add text/subtitles to videos
- Resize, crop, rotate videos
- Merge audio with video
- Add filters, effects, transitions
- Convert between formats (MP4, AVI, MOV, GIF...)
- Extract frames / create thumbnails
- Compress videos to smaller sizes

### `POST /v1/render`

```json
{
  "ffmpeg_command": "-i {{in_1}} -vf \"drawtext=text='Hello World':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-th-20\" -c:v libx264 -preset fast {{out_1}} -y",
  "input_files": {
    "in_1": "https://example.com/my-video.mp4"
  },
  "output_files": {
    "out_1": "final-video.mp4"
  }
}
```

**Response:**
```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING",
  "engine": "ffmpeg",
  "worker": "ffmpeg-api-3"
}
```

**Get result:**
```bash
GET /v1/commands/550e8400-e29b-41d4-a716-446655440000
```

**Successful response:**
```json
{
  "command_id": "550e8400-...",
  "status": "SUCCESS",
  "output_files": {
    "out_1": {
      "url": "https://pub-xxx.r2.dev/final-video.mp4"
    }
  },
  "total_processing_seconds": 32.5
}
```

### FFmpeg Command Examples

> The `{{in_1}}`, `{{in_2}}` etc. get replaced with downloaded file paths.  
> The `{{out_1}}`, `{{out_2}}` etc. get replaced with output file paths.

| What you want | FFmpeg Command |
|--------------|---------------|
| **Add text overlay** | `-i {{in_1}} -vf "drawtext=text='Hello':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-th-20" {{out_1}} -y` |
| **Resize to 720p** | `-i {{in_1}} -vf scale=1280:720 -c:v libx264 -preset fast {{out_1}} -y` |
| **Add audio track** | `-i {{in_1}} -i {{in_2}} -c:v copy -c:a aac -shortest {{out_1}} -y` |
| **Create GIF** | `-i {{in_1}} -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif {{out_1}} -y` |
| **Extract audio** | `-i {{in_1}} -vn -c:a libmp3lame {{out_1}} -y` |
| **Crop video** | `-i {{in_1}} -vf "crop=640:480:100:100" {{out_1}} -y` |
| **Speed up 2x** | `-i {{in_1}} -filter:v "setpts=0.5*PTS" -filter:a "atempo=2.0" {{out_1}} -y` |
| **Compress (smaller file)** | `-i {{in_1}} -c:v libx264 -crf 28 -preset medium -c:a aac -b:a 64k {{out_1}} -y` |
| **Concatenate 2 videos** | `-i {{in_1}} -i {{in_2}} -filter_complex "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1" {{out_1}} -y` |
| **Create thumbnail** | `-i {{in_1}} -ss 00:05 -vframes 1 {{out_1}} -y` |
| **Add subtitles (SRT file)** | `-i {{in_1}} -vf "subtitles={{in_2}}" {{out_1}} -y` |
| **Watermark (logo on video)** | `-i {{in_1}} -i {{in_2}} -filter_complex "overlay=W-w-10:10" {{out_1}} -y` |

---

## 🎤 Feature 2: Speech-to-Text (Transcribe)

### What you get:
- **Full text** of everything said
- **Every word** with its exact start/end time in seconds
- **Silence gaps** — where pauses happen between words
- **Speaking rate** — words per minute
- **Audio metadata** — duration, sample rate, codec

### Use cases for n8n:
- Sync speech to video scenes **word-by-word**
- Generate subtitles / captions automatically
- Create transcript-based chapters
- Auto-sync voiceover to script timing
- Know exactly when silences happen for scene transitions
- Cut out silences automatically

### `POST /v1/transcribe`

```json
{
  "audio_url": "https://example.com/voiceover.mp3",
  "language": "auto",
  "model_size": "base",
  "word_timestamps": true
}
```

**Response** (after polling):
```json
{
  "command_id": "transcribe_a1b2c3d4e5f6",
  "status": "SUCCESS",
  "transcript": {
    "full_text": "مرحباً بكم في هذا الفيديو التعليمي. اليوم سوف نتعلم كيفية استخدام هذه الأداة الرائعة.",
    "language": "ar",
    "model": "base",
    "segments": [
      { "id": 0, "start": 0.0, "end": 4.5, "text": "مرحباً بكم في هذا الفيديو التعليمي.", "confidence": 0.98 },
      { "id": 1, "start": 5.2, "end": 10.1, "text": "اليوم سوف نتعلم كيفية استخدام هذه الأداة الرائعة.", "confidence": 0.96 }
    ],
    "words": [
      { "word": "مرحباً", "start": 0.0, "end": 0.5, "confidence": 0.99, "index": 0 },
      { "word": "بكم", "start": 0.5, "end": 0.9, "confidence": 0.97, "index": 1 },
      { "word": "في", "start": 0.9, "end": 1.1, "confidence": 0.95, "index": 2 },
      { "word": "هذا", "start": 1.1, "end": 1.4, "confidence": 0.96, "index": 3 },
      { "word": "الفيديو", "start": 1.5, "end": 2.2, "confidence": 0.98, "index": 4 },
      { "word": "التعليمي.", "start": 2.3, "end": 4.5, "confidence": 0.97, "index": 5 }
    ]
  },
  "speech_analysis": {
    "total_words": 88,
    "total_speech_seconds": 45.2,
    "total_silence_seconds": 12.8,
    "speaking_rate_wpm": 155.3,
    "silence_gaps": [
      { "start": 4.5, "end": 5.2, "duration": 0.7 },
      { "start": 10.1, "end": 11.0, "duration": 0.9 }
    ]
  },
  "audio_metadata": {
    "duration_seconds": 58.0,
    "sample_rate": 16000
  }
}
```

### n8n — Sync words to scenes

You have 3 scenes of 5 seconds each. You want to know which words fall into each scene:

```javascript
// n8n Code Node
const words = $input.first().json.transcript.words;
const sceneDuration = 5; // seconds per scene
const scenes = [];

words.forEach(word => {
  const sceneIndex = Math.floor(word.start / sceneDuration);
  if (!scenes[sceneIndex]) {
    scenes[sceneIndex] = { scene: sceneIndex + 1, start: sceneIndex * 5, end: (sceneIndex + 1) * 5, words: [], text: '' };
  }
  scenes[sceneIndex].words.push(word);
  scenes[sceneIndex].text += word.word + ' ';
});

return scenes.filter(Boolean);
```

**Output:**
```json
[
  { "scene": 1, "start": 0, "end": 5, "words": [...], "text": "مرحباً بكم في هذا الفيديو..." },
  { "scene": 2, "start": 5, "end": 10, "words": [...], "text": "اليوم سوف نتعلم كيفية..." },
  { "scene": 3, "start": 10, "end": 15, "words": [...], "text": "استخدام هذه الأداة الرائعة." }
]
```

### n8n — Generate SRT subtitles

```javascript
// n8n Code Node
const words = $input.first().json.transcript.words;
const WORDS_PER_SUB = 7;
let srt = '', counter = 1;

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

for (let i = 0; i < words.length; i += WORDS_PER_SUB) {
  const chunk = words.slice(i, i + WORDS_PER_SUB);
  srt += `${counter}\n${fmt(chunk[0].start)} --> ${fmt(chunk[chunk.length - 1].end)}\n${chunk.map(w => w.word).join(' ')}\n\n`;
  counter++;
}

return srt;
```

### n8n — Use silence gaps for scene transitions

```javascript
// n8n Code Node
const analysis = $input.first().json.speech_analysis;

// Find silences longer than 1 second — perfect for scene transitions
const transitionPoints = analysis.silence_gaps
  .filter(gap => gap.duration >= 1.0)
  .map(gap => ({
    cutAt: gap.end,
    duration: gap.duration,
    type: gap.duration >= 2 ? 'scene_change' : 'cut'
  }));

return {
  silenceCount: analysis.silence_count,
  transitionPoints,
  totalSilence: analysis.total_silence_seconds,
  speakingRate: analysis.speaking_rate_wpm,
  // If script is 100 words and WPM is 150 → needs 40 seconds of video
  estimatedDurationForScript: (100 / analysis.speaking_rate_wpm) * 60
};
```

---

## 📊 Feature 3: Audio Probe (Analysis Only)

### When to use instead of /v1/transcribe:
- You only need **timing info**, not the text
- You want to **pre-check** an audio before full transcription
- You need **loudness data** (LUFS levels)
- Speed matters — it's **10-30 seconds** instead of 1-5 minutes

### `POST /v1/audio-probe`

```json
{
  "audio_url": "https://example.com/voiceover.mp3"
}
```

**Response:**
```json
{
  "command_id": "probe_a1b2c3d4e5f6",
  "status": "SUCCESS",
  "probe": {
    "audio_metadata": {
      "duration_seconds": 45.3,
      "sample_rate": 44100,
      "channels": 2,
      "codec": "mp3",
      "bit_rate": 128000,
      "format_name": "mp3",
      "size_bytes": 724800
    },
    "speech_analysis": {
      "total_speech_seconds": 32.1,
      "total_silence_seconds": 13.2,
      "speech_density_percent": 70.9,
      "estimated_speaking_rate_wpm": 150,
      "silence_gaps": [
        { "start": 0.0, "end": 0.8, "duration": 0.8 },
        { "start": 4.2, "end": 5.1, "duration": 0.9 }
      ],
      "silence_count": 12
    },
    "loudness": {
      "integrated_lufs": -16.2,
      "peak_dbfs": -1.5
    }
  }
}
```

### n8n — Smart decision: Probe first, Transcribe if needed

```javascript
// n8n Code Node — Run after /v1/audio-probe returns
const probe = $input.first().json.probe;

return {
  duration: probe.audio_metadata.duration_seconds,
  
  // If audio is short (< 30s), auto-transcribe
  needsTranscription: probe.audio_metadata.duration_seconds <= 300,
  
  // If lots of silence, it's a slow talker
  talkStyle: probe.speech_analysis.speech_density_percent > 80 ? 'fast/dense' 
           : probe.speech_analysis.speech_density_percent > 50 ? 'normal' 
           : 'slow/paused',
  
  // For a 100-word script, how many seconds needed?
  estimatedSceneDuration: (100 / probe.speech_analysis.estimated_speaking_rate_wpm) * 60,
  
  // If audio is too quiet, warn
  loudnessWarning: probe.loudness?.integrated_lufs < -20 ? 'Audio is too quiet! Normalize first.' : 'OK'
};
```

---

## 🎬 n8n Integration: Syncing Speech to Scenes

This is what you described — giving audio and getting timing data to sync scenes perfectly.

### Complete n8n Workflow

```
[Trigger] → [HTTP: POST /v1/transcribe] → [Wait 30s] → [HTTP: GET status] → 
  [Loop until SUCCESS] → [Code: Process words into scenes] → 
  [Generate video with FFmpeg using timing data]
```

### Step-by-step in n8n:

#### Step 1: HTTP Request Node → POST `/v1/transcribe`
```json
{
  "audio_url": "https://storage.rendi.dev/sample/sample.mp3",
  "language": "en",
  "model_size": "base",
  "word_timestamps": true
}
```

#### Step 2: Wait Node — 30 seconds

#### Step 3: HTTP Request Node → GET `/v1/commands/{{ $json.command_id }}`

#### Step 4: IF Node — check `status === "SUCCESS"`
- If **PROCESSING** → Loop back to Step 2
- If **SUCCESS** → Continue to Step 5
- If **FAILED** → Error handler

#### Step 5: Code Node — Map words to scene timings

```javascript
// You have a script like:
const script = "Welcome to this amazing video about n8n and FFmpeg";
const words = $input.first().json.transcript.words;
const sceneLength = 5; // each scene = 5 seconds

// Split script words
const scriptWords = script.split(' ');
const wordDuration = scriptWords.length / words.length; // scaling factor

// Your scenes with timestamps
const scenes = [];
let wordIndex = 0;

words.forEach((w, i) => {
  const sceneNum = Math.floor(w.start / sceneLength) + 1;
  if (!scenes[sceneNum]) {
    scenes[sceneNum] = { 
      scene: sceneNum, 
      startTime: w.start, 
      endTime: w.end, 
      words: [], 
      text: '' 
    };
  }
  scenes[sceneNum].words.push(w);
  scenes[sceneNum].text += w.word + ' ';
  scenes[sceneNum].endTime = w.end;
});

// Now each scene knows exactly when it plays
return scenes.filter(Boolean).map(s => ({
  ...s,
  duration: s.endTime - s.startTime,
  // FFmpeg trim command for this scene
  ffmpeg_trim: `-ss ${s.startTime} -i {{in_video}} -t ${s.duration} -c copy scene_${s.scene}.mp4 -y`
}));
```

#### Step 6: Use the timing data to split the video with FFmpeg

Send to `POST /v1/render`:
```json
{
  "ffmpeg_command": "-ss 0.0 -i {{in_1}} -t 5.2 -c copy {{out_1}} -y",
  "input_files": {
    "in_1": "https://pub-xxx.r2.dev/original-video.mp4"
  },
  "output_files": {
    "out_1": "scene_1.mp4"
  }
}
```

---

## 🌐 Real-World Workflows

### Workflow 1: YouTube Shorts / TikTok Auto-Generator

```
1. [Input: audio file + script text]
2. POST /v1/transcribe → get word timestamps
3. Compare actual words to the script → check accuracy
4. POST /v1/render → use FFmpeg to add captions synced to audio
5. POST /v1/render → trim silence gaps for compact shorts
6. Download the final video from R2 URL
```

### Workflow 2: Podcast → Video with Chapters

```
1. POST /v1/transcribe → get full transcript
2. POST /v1/audio-probe → get silence gaps for chapters
3. Use silence gaps 3s+ as chapter markers
4. POST /v1/render → split podcast into chapter videos
5. Add chapter title cards at each chapter start
```

### Workflow 3: Dub / Voiceover Sync Check

```
1. POST /v1/transcribe → get original audio transcript + timing
2. POST /v1/transcribe → get dubbed audio transcript + timing
3. Compare word-by-word timestamps → detect mismatches
4. If mismatch > 0.5s → adjust video speed for that section
5. POST /v1/render → render the time-adjusted video
```

### Workflow 4: Automated Content Repurposing

```
1. POST /v1/audio-probe → check duration + loudness
2. If loudness < -20 LUFS → normalize
3. POST /v1/transcribe → get transcript
4. Cut into 30-second clips based on silence gaps
5. POST /v1/render (for each clip) → render with captions
6. Upload all to social media platforms
```

### Workflow 5: Interview → Animated Subtitles

```javascript
// 1. Transcribe the interview
// POST /v1/transcribe { audio_url: "interview.mp3" }

// 2. Get words with timestamps
const words = $json.transcript.words;

// 3. Detect who is speaking (if 2 speakers, alternate)
// Use silence gaps + word timing to identify speaker changes
const speakers = [];
let currentSpeaker = 'Speaker A';
let lastEnd = 0;

words.forEach((w, i) => {
  // If gap > 0.8s, likely speaker changed
  if (w.start - lastEnd > 0.8) {
    currentSpeaker = currentSpeaker === 'Speaker A' ? 'Speaker B' : 'Speaker A';
    speakers.push({ 
      speaker: currentSpeaker, 
      start: w.start, 
      words: [] 
    });
  }
  speakers[speakers.length - 1].words.push(w);
  lastEnd = w.end;
});

// 4. Generate two-color captions with FFmpeg
// Each speaker's lines get different colors
```

---

## 🎯 Model Size Guide (for Whisper)

| Model | Speed | Quality | VRAM | Use when... |
|-------|-------|---------|------|-------------|
| `tiny` | 🚀 10x | 😐 OK | ~1 GB | Testing, short clips |
| `base` | ⚡ 7x | 😊 Good | ~1 GB | **Default — recommended** |
| `small` | 🐢 4x | 😄 Great | ~2 GB | Normal audio quality |
| `medium` | 🐌 2x | 🤩 Excellent | ~5 GB | Low quality audio |
| `large` | 🐢🐢 1x | 🏆 Best | ~10 GB | Maximum accuracy |

**Arabic tip:** `base` works well for Arabic. If accuracy is low, try `small`.

**English tip:** `base` is excellent for English. Only use `medium`+ if audio has heavy background noise.

> ⏱ First run always takes longer because Whisper downloads the model. Subsequent runs use the cached model.

---

## ❌ Error Handling & Tips

### "status": "PROCESSING" hangs for too long?

Jobs time out after:
- **Render:** 15 minutes
- **Transcribe:** 30 minutes
- **Audio probe:** 10 minutes

If still PROCESSING after that, check GitHub Actions logs at:
`https://github.com/YOUR_USER/ffmpeg-api-N/actions`

### Failed job — what went wrong?

The response includes:
```json
{
  "status": "FAILED",
  "error_message": "Failed at step \"Download audio\""
}
```

Common failures:
| Error | Cause | Fix |
|-------|-------|-----|
| `Failed to download` | Audio URL inaccessible | Make sure URL is public |
| `Conversion failed` | Unsupported format | Use MP3 or WAV |
| `No audio source` | Missing both `audio_url` and `audio_base64` | Provide one |
| Audio too quiet | Low recording volume | Normalize before sending |

### Rate limiting

Maximum **50 concurrent tasks** across all workers. If you hit it:
```json
{
  "detail": "Max 50 concurrent tasks"
}
```

Wait for existing jobs to finish, or increase `MAX_CONCURRENT_TASKS` in env vars.

### Audio format support

Any format **FFmpeg** supports:
- **Audio:** MP3, WAV, M4A, AAC, OGG, FLAC, WMA
- **Video with audio track:** MP4, AVI, MOV, MKV, WEBM
- Maximum duration: ~20 minutes (GitHub Actions limit)

### Tips for best transcription

1. **Use 16-bit WAV or high-bitrate MP3** for best results
2. **Reduce background noise** before sending (or use `medium`+ model)
3. **Set `language` explicitly** if you know it — improves speed & accuracy
4. **Keep audio under 10 minutes** for fast processing
5. **For very long audio**, split into chunks with FFmpeg first:
   ```
   ffmpeg -i long.mp3 -f segment -segment_time 300 chunk_%03d.mp3
   ```

---

## 📊 Comparison Table

| Task | Endpoint | Time | Returns |
|------|----------|------|---------|
| Add text to video | `POST /v1/render` | ~1-5 min | Video URL |
| Add audio to video | `POST /v1/render` | ~1-5 min | Video URL |
| Resize/compress | `POST /v1/render` | ~1-5 min | Video URL |
| Transcribe + timing | `POST /v1/transcribe` | ~1-5 min | Words with timestamps |
| Get silence gaps | `POST /v1/transcribe` | ~1-5 min | Silence positions |
| Get loudness level | `POST /v1/audio-probe` | ~10-30 sec | LUFS, peak dBFS |
| Check audio duration | `POST /v1/audio-probe` | ~10-30 sec | Duration in seconds |
| Estimate speaking rate | `POST /v1/audio-probe` | ~10-30 sec | Estimated WPM |

---

## 🎯 Quick Decision Flow

```
You have audio/video
    │
    ├── Do you want to process/edit video?
    │   └── → POST /v1/render  (with FFmpeg command)
    │
    ├── Do you need the spoken text?
    │   ├── Yes → POST /v1/transcribe
    │   └── No, just timing/WPM/silence?
    │       └── → POST /v1/audio-probe
    │
    └── Do you need both? (Check first, then transcribe)
        ├── 1st → POST /v1/audio-probe  (check duration, loudness)
        └── 2nd → POST /v1/transcribe    (get full text + timing)
```

---

## 💡 One n8n workflow to rule them all

Here's a template you can use directly in n8n:

**Nodes:**
1. **Manual Trigger** — paste your audio URL
2. **HTTP Request** — `POST /v1/audio-probe` with `{ audio_url }`
3. **Wait** — 15 seconds
4. **HTTP Request** — `GET /v1/commands/{{ $json.command_id }}`
5. **IF** — status === "SUCCESS" → continue, else → loop to step 3
6. **Code** — "Audio is {{ $json.probe.audio_metadata.duration_seconds }}s long with {{ $json.probe.speech_analysis.silence_count }} silence gaps"
7. **HTTP Request** — `POST /v1/transcribe` with same `{ audio_url, model_size: "base" }`
8. **Wait** — 60 seconds
9. **Loop** — GET status until SUCCESS
10. **Code** — Process transcript into scene-timed script matches
11. **HTTP Request** — `POST /v1/render` with FFmpeg command using timing data

---

## ✅ Checklist for first use

- [ ] I get a `command_id` back when I POST
- [ ] I can check status with `GET /v1/commands/:id`
- [ ] Transcribe returns `transcript.words[].start` and `.end`
- [ ] Transcribe returns `speech_analysis.silence_gaps[]`
- [ ] Audio probe returns `speech_analysis` and `loudness`
- [ ] I can use words timing to map audio to scenes

---

> **Quick test — send any audio URL and check what you get back:**
> ```bash
> # Replace YOUR_SERVER with your actual URL
> curl -X POST https://YOUR_SERVER.onrender.com/v1/audio-probe \
>   -H "Content-Type: application/json" \
>   -d '{"audio_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"}'
> ```
> 
> Wait 15s then:
> ```bash
> curl https://YOUR_SERVER.onrender.com/v1/commands/PROBE_ID
> ```

---

**Made with ❤️ — free video processing + speech analysis for everyone**
