# 🎬 FFmpeg-Free-API — Complete User Guide

> Zero-cost video & audio processing using GitHub Actions + Cloudflare R2.
> Upload audio → get word-level transcripts with timestamps → sync to video scenes in n8n.

---

## 📋 How It Works

```
You (n8n) → POST /v1/transcribe → API Server (Render) → GitHub Actions Worker → Cloudflare R2
                   ↓                                                         ↓
              Poll GET /v1/commands/{id} ←────── ←────── ←────── ←── Result ready
```

- You send audio (URL or binary) to the API
- API triggers a GitHub Actions workflow on one of **6 worker repos**
- Worker processes audio (FFmpeg + Whisper AI) and uploads result JSON to Cloudflare R2
- You poll `GET /v1/commands/{id}` until status is `SUCCESS`
- Result contains every word with `start` and `end` timestamps — perfect for syncing to video

**All for $0/month.** No AWS, no GPU servers, no OpenAI bills.

---

## 🔐 Authentication

Set an `API_KEY` environment variable on your Render server. Pass it in every request:

```
x-api-key: your-api-key
```

Or as a Bearer token:
```
Authorization: Bearer your-api-key
```

---

## 🛣️ API Endpoints

---

### 1. 🎤 `POST /v1/audio-probe` — Fast Audio Analysis

**Purpose:** Get audio metadata, silence gaps, and speaking rate estimate.  
**Speed:** ~10–30 seconds. **No AI model download.** Just FFmpeg probe + silence detection.

#### Request

```json
{
  "audio_url": "https://example.com/recording.mp3",
  "command_id": "scene_1_probe",
  "metadata": { "scene": "intro" }
}
```

Or with raw binary:

```json
{
  "audio_base64": "//uQxAAAAAANIAAAAAE...base64encodeddata...",
  "command_id": "scene_2_probe"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `audio_url` | one of | string | Public URL to an audio file |
| `audio_base64` | one of | string | Base64-encoded audio binary |
| `command_id` | no | string | Your own ID (auto-generated if omitted) |
| `metadata` | no | object | Any custom data you want stored with the job |

#### Immediate Response

```json
{
  "command_id": "scene_1_probe",
  "status": "PROCESSING",
  "type": "AUDIO_PROBE",
  "worker": "ffmpeg-api-3",
  "run_id": 1234567890,
  "message": "Use GET /v1/commands/scene_1_probe to get results when ready"
}
```

#### Final Result (poll until `status: "SUCCESS"`)

```json
{
  "command_id": "scene_1_probe",
  "status": "SUCCESS",
  "command_type": "AUDIO_PROBE",
  "worker": "ffmpeg-api-3",
  "probe": {
    "type": "audio_probe",
    "command_id": "scene_1_probe",
    "audio_metadata": {
      "duration_seconds": 45.2,
      "sample_rate": 44100,
      "channels": 1,
      "codec": "aac",
      "bit_rate": 128000,
      "format_name": "mp3",
      "size_bytes": 723456
    },
    "speech_analysis": {
      "total_speech_seconds": 38.5,
      "total_silence_seconds": 6.7,
      "speech_density_percent": 85.2,
      "speech_to_silence_ratio": 5.75,
      "estimated_speaking_rate_wpm": 145,
      "estimated_speaking_rate_label": "normal",
      "note": "Estimate from silence density. Use POST /v1/transcribe for exact WPM.",
      "silence_count": 12,
      "silence_density": 15.9,
      "silence_gaps": [
        { "start": 2.5, "end": 3.2, "duration": 0.7 },
        { "start": 15.1, "end": 16.3, "duration": 1.2 },
        { "start": 28.0, "end": 29.5, "duration": 1.5 }
      ]
    },
    "loudness": {
      "integrated_lufs": -16.5,
      "loudness_range_lu": 12.3,
      "peak_dbfs": -2.1
    }
  },
  "total_processing_seconds": 18.5
}
```

---

### 2. 📝 `POST /v1/transcribe` — Full Speech-to-Text with Word Timestamps

**Purpose:** Get exact transcript with every word timestamped.  
**Speed:** ~1–10 minutes (depends on `model_size` and audio length).  
**Uses:** OpenAI Whisper (runs on GitHub's free runners).

#### Request

```json
{
  "audio_url": "https://example.com/podcast.wav",
  "language": "auto",
  "model_size": "base",
  "word_timestamps": true,
  "command_id": "podcast_ep_50"
}
```

| Field | Options | Default | Description |
|-------|---------|---------|-------------|
| `audio_url` | — | — | Public URL to audio file (required if no base64) |
| `audio_base64` | — | — | Base64-encoded audio binary (required if no URL) |
| `language` | `auto`, `en`, `ar`, `fr`, `es`, etc. | `auto` | Force a language for better accuracy |
| `model_size` | `tiny`, `base`, `small`, `medium`, `large` | `base` | Larger = more accurate but slower |
| `word_timestamps` | `true`, `false` | `true` | Word-level timestamps for video syncing |
| `command_id` | — | auto | Your own tracking ID |

#### Model Speed Guide

| Model | Audio Length 5min | Audio Length 30min | Accuracy |
|-------|-------------------|--------------------|----------|
| `tiny` | ~30s | ~2min | OK |
| `base` | ~1min | ~3min | Good |
| `small` | ~2min | ~6min | Better |
| `medium` | ~4min | ~12min | Great |
| `large` | ~8min | ~25min | Best |

#### Final Result

```json
{
  "command_id": "podcast_ep_50",
  "status": "SUCCESS",
  "command_type": "TRANSCRIBE",
  "transcript": {
    "full_text": "Hello and welcome to this podcast episode where we discuss how to sync audio to video scenes using n8n automation...",
    "language": "en",
    "model": "base",
    "segments": [
      {
        "id": 0,
        "start": 0.0,
        "end": 4.5,
        "text": " Hello and welcome to this podcast episode",
        "confidence": 0.987
      },
      {
        "id": 1,
        "start": 4.7,
        "end": 9.2,
        "text": " where we discuss how to sync audio to video scenes",
        "confidence": 0.963
      }
    ],
    "words": [
      { "word": "Hello",   "start": 0.0,  "end": 0.3,  "confidence": 0.99, "index": 0 },
      { "word": "and",     "start": 0.35, "end": 0.45, "confidence": 0.98, "index": 1 },
      { "word": "welcome", "start": 0.5,  "end": 0.85, "confidence": 0.97, "index": 2 },
      { "word": "to",      "start": 0.9,  "end": 1.0,  "confidence": 0.99, "index": 3 },
      { "word": "this",    "start": 1.1,  "end": 1.2,  "confidence": 0.98, "index": 4 },
      { "word": "podcast", "start": 1.3,  "end": 1.6,  "confidence": 0.96, "index": 5 }
    ]
  },
  "audio_metadata": {
    "duration_seconds": 45.2,
    "sample_rate": 16000,
    "channels": 1,
    "codec": "pcm_s16le",
    "bit_rate": 256000,
    "format_name": "wav",
    "size_bytes": 1808000
  },
  "speech_analysis": {
    "total_words": 320,
    "total_speech_seconds": 38.5,
    "total_silence_seconds": 6.7,
    "speech_to_silence_ratio": 5.75,
    "speaking_rate_wpm": 145.2,
    "average_word_confidence": 0.95,
    "silence_gaps": [
      { "start": 4.5, "end": 4.7, "duration": 0.2 },
      { "start": 9.2, "end": 10.5, "duration": 1.3 }
    ]
  },
  "total_processing_seconds": 187.3
}
```

---

### 3. ⏳ `GET /v1/commands/{command_id}` — Poll for Results

After triggering any job, use this to wait for completion.

**Poll every 5 seconds in your n8n workflow.**

#### While Processing

```json
{
  "command_id": "podcast_ep_50",
  "status": "PROCESSING",
  "command_type": "TRANSCRIBE",
  "worker": "ffmpeg-api-3"
}
```

#### On Success
Full result with `probe` or `transcript` data (shown above).

#### On Failure

```json
{
  "command_id": "podcast_ep_50",
  "status": "FAILED",
  "command_type": "TRANSCRIBE",
  "error_message": "Failed at step \"Run Whisper Speech-to-Text\"",
  "error_status": "PROCESSING_ERROR"
}
```

---

### 4. 🎥 `POST /v1/render` — Custom FFmpeg Video Processing

**Purpose:** Run any FFmpeg command. Concatenate videos, add overlay, trim, crop, apply filters.

#### Request

```json
{
  "ffmpeg_command": "-i $in_1 -i $in_2 -filter_complex overlay=10:10 -c:a copy output.mp4",
  "input_files": {
    "in_1": "https://example.com/background.mp4",
    "in_2": "https://example.com/logo.png"
  },
  "output_files": {
    "out_1": "result_with_logo.mp4"
  },
  "max_command_run_seconds": "600"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `ffmpeg_command` | yes | Standard FFmpeg syntax. Use `$in_1`, `$in_2` etc. for input files |
| `input_files` | no | Object mapping `in_1`, `in_2`... to public URLs |
| `output_files` | no | Object mapping `out_1`, `out_2`... to filenames |
| `max_command_run_seconds` | no | Timeout (default 600s) |

#### Examples

**Trim video to specific time range:**
```json
{
  "ffmpeg_command": "-ss 10 -i $in_1 -t 30 -c copy output.mp4",
  "input_files": { "in_1": "https://example.com/long_video.mp4" }
}
```

**Concatenate two videos:**
```json
{
  "ffmpeg_command": "-i $in_1 -i $in_2 -filter_complex concat=2:v=1:a=1 -c:a copy output.mp4",
  "input_files": {
    "in_1": "https://example.com/clip1.mp4",
    "in_2": "https://example.com/clip2.mp4"
  }
}
```

---

### 5. 🎨 `POST /v1/render` with Remotion Engine

**Purpose:** Programmatically generate videos with React components (text overlays, animations, data-driven visuals).

```json
{
  "engine": "remotion",
  "remotion_component_code": "const MyComp = () => <div style={{background:'red'}}>{frame}</div>",
  "remotion_props_json": { "title": "My Video" },
  "duration": "10",
  "fps": "30",
  "width": "1080",
  "height": "1920"
}
```

---

### 6. ❤️ `GET /health` — Server Health
```json
{ "status": "ok" }
```

---

## 🧩 n8n Integration Guide

### Scenario A: Sync Audio to Video Scenes (Your Main Use Case)

**Step 1 — HTTP Request Node (Transcribe):**
```
Method: POST
URL: https://your-app.onrender.com/v1/transcribe
Headers: { "x-api-key": "{{$credentials.apiKey}}" }
Body (JSON):
{
  "audio_url": "{{$json.audioFileUrl}}",
  "model_size": "base",
  "word_timestamps": true
}
```

**Step 2 — Loop Node (Poll for Result):**
```
Method: GET
URL: https://your-app.onrender.com/v1/commands/{{$json.command_id}}
Headers: { "x-api-key": "{{$credentials.apiKey}}" }

// Use n8n's "Wait" node (5s delay) + loop until status === "SUCCESS"
// Max ~60 iterations (5 minutes max processing time)
```

**Step 3 — Cut Video Scenes Using Transcript (Code Node):**
```javascript
// words[] has every word with start/end timestamps
// Group words by sentence or segment to get scene boundaries
const transcript = $json.transcript;
const segments = transcript.segments;  // sentence-level with start/end

// Each segment becomes a video clip
for (const segment of segments) {
  const ffmpegCmd = `-ss ${segment.start} -i $in_1 -t ${segment.end - segment.start} -c copy scene_${segment.id}.mp4`;
  // Send to /v1/render for each scene
}
```

**Step 4 — Render Each Scene (HTTP Request Node in Loop):**
```json
{
  "ffmpeg_command": "-ss {{$json.start}} -i $in_1 -t {{$json.end - $json.start}} output.mp4",
  "input_files": {
    "in_1": "https://example.com/main_video.mp4"
  },
  "output_files": {
    "out_1": "scene_{{$json.id}}.mp4"
  }
}
```

### Scenario B: Quick Silence Check Before Transcribing

**Node 1 — Audio Probe:**
```
POST /v1/audio-probe
{ "audio_url": "https://..." }
```

**Node 2 — Decide (Code Node):**
```javascript
const probe = $json.probe.speech_analysis;
if (probe.speech_density_percent > 20 && probe.total_speech_seconds > 10) {
  // Has enough speech — proceed to transcribe
  return { action: "transcribe" };
} else {
  // Mostly silence — skip
  return { action: "skip", reason: "Not enough speech content" };
}
```

### Scenario C: Get Speaking Rate for Video Pacing

```javascript
// From audio-probe result
const wpm = $json.probe.speech_analysis.estimated_speaking_rate_wpm;
const label = $json.probe.speech_analysis.estimated_speaking_rate_label;

// Adjust video speed based on speaking rate
if (label === "fast") {
  // Speaker talks fast — keep cuts short
  sceneDuration = 3;  // seconds
} else if (label === "slow") {
  // Speaker talks slow — longer scenes
  sceneDuration = 8;
} else {
  sceneDuration = 5;
}
```

---

## ⚡ Speed & Performance

| Endpoint | Typical Time | What Happens |
|----------|-------------|--------------|
| `POST /v1/audio-probe` | 10–30s | FFmpeg probe + silence/loudness analysis |
| `POST /v1/transcribe` (tiny) | 1–3 min | Download model + Whisper transcription |
| `POST /v1/transcribe` (base) | 2–5 min | ^ |
| `POST /v1/transcribe` (large) | 10–30 min | ^ (most accurate) |
| `POST /v1/render` (ffmpeg) | 10s–5min | Depends on video length + complexity |

**Important:** GitHub Actions has a 30-minute timeout per workflow run.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   n8n / Your │────▶│  API Server  │────▶│ GitHub Actions  │
│    App       │     │  (Render)    │     │ (6x Workers)    │
└─────────────┘     └──────────────┘     └────────┬────────┘
       ▲                                           │
       │            ┌─────────────────┐            │
       └────────────│  Cloudflare R2  │◀───────────┘
                    │  (Result Store) │
                    └─────────────────┘
```

### Worker Repos (6 total):
- `ffmpeg-api`, `ffmpeg-api-2`, `ffmpeg-api-3`
- `ffmpeg-api-4`, `ffmpeg-api-5`, `ffmpeg-api-6`

Jobs are distributed round-robin across all workers. Max 50 concurrent tasks.

---

## 🛠️ Environment Variables (on Render)

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | GitHub PAT with `actions` + `contents` scope |
| `GITHUB_USERNAME` | ✅ | `Mohammedalilgrh` |
| `R2_PUBLIC_URL` | ✅ | Cloudflare R2 public bucket URL |
| `API_KEY` | ✅ | Secret key for API authentication |
| `MAX_CONCURRENT_TASKS` | no | Default: 50 |
| `R2_ACCESS_KEY` | ✅ | R2 access key |
| `R2_SECRET_KEY` | ✅ | R2 secret key |
| `R2_BUCKET` | ✅ | R2 bucket name |
| `R2_ENDPOINT` | ✅ | R2 endpoint URL |

---

## ❌ Error Responses

| HTTP Status | Meaning |
|-------------|---------|
| 401 | Invalid or missing API key |
| 422 | Missing required fields (e.g., no audio source) |
| 429 | Too many concurrent tasks (max 50) |
| 500 | Server error |

All errors return:
```json
{
  "status": "FAILED",
  "detail": "Error message here..."
}
```

---

## 📦 Quick Reference Table

| Endpoint | Method | Purpose | Avg Time |
|----------|--------|---------|----------|
| `/v1/audio-probe` | POST | Audio metadata + silence + speaking rate | 15s |
| `/v1/transcribe` | POST | Full transcript with word timestamps | 2–5 min |
| `/v1/render` (ffmpeg) | POST | Custom FFmpeg video processing | 10s–5min |
| `/v1/render` (remotion) | POST | Programmatic video generation | 1–10min |
| `/v1/run-ffmpeg-command` | POST | Rendi.dev-compatible FFmpeg | 10s–5min |
| `/v1/commands/{id}` | GET | Poll for job result | instant |
| `/v1/commands/{id}/check` | POST | Force re-check job status | instant |
| `/health` | GET | Server health check | instant |

---

## FAQ

**Q: How much does this cost?**
A: $0. GitHub Actions gives 2000 free minutes/month. Cloudflare R2 has 10GB free storage + 1M free operations.

**Q: Why is transcribe slow?**
A: Whisper models download on first run (~150MB for `base`) and run on CPU. Use `tiny` for speed, `large` for accuracy.

**Q: Max audio/video file size?**
A: GitHub Actions runners have ~14GB disk. Real limit is the 30-minute workflow timeout.

**Q: Can I use long audio files?**
A: Yes, but `large` model on a 2-hour podcast may timeout. Use `tiny` or `base` for long files.

**Q: What audio formats are supported?**
A: Everything FFmpeg supports: MP3, WAV, M4A, FLAC, OGG, AAC, WMA, etc. Converted to 16kHz WAV automatically.
