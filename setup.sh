#!/bin/bash
set -e

clear
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   🎬 إعداد FFmpeg API - بديل Rendi.dev مجاني                 ║"
echo "║   إنشاء 6 مستودعات GitHub للعمال                              ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# التحقق من المتطلبات
command -v node >/dev/null 2>&1 || { echo "❌ Node.js مطلوب - حمله من nodejs.org"; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git مطلوب - حمله من git-scm.com"; exit 1; }

# جمع المعلومات
echo "📝 معلومات GitHub:"
read -p "   اسم المستخدم: " GH_USERNAME
read -sp "   Token (يحتاج صلاحيات repo و workflow): " GH_TOKEN
echo ""
echo ""

echo "📝 معلومات Cloudflare R2:"
read -p "   R2 Access Key ID: " R2_ACCESS_KEY
read -sp "   R2 Secret Access Key: " R2_SECRET_KEY
echo ""
read -p "   R2 Bucket Name: " R2_BUCKET
read -p "   R2 Endpoint (مثال: https://xxx.r2.cloudflarestorage.com): " R2_ENDPOINT
read -p "   R2 Public URL (مثال: https://pub-xxx.r2.dev): " R2_PUBLIC_URL
echo ""

echo "🚀 بدء إنشاء المستودعات..."
sleep 2

# إنشاء المستودعات الستة
for i in 1 2 3 4 5 6; do
    if [ $i -eq 1 ]; then
        REPO_NAME="ffmpeg-api"
    else
        REPO_NAME="ffmpeg-api-${i}"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 إعداد ${REPO_NAME} (${i}/6)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # إنشاء المستودع
    echo "  ⏳ إنشاء المستودع..."
    CREATE_RESPONSE=$(curl -s -X POST "https://api.github.com/user/repos" \
        -H "Authorization: token ${GH_TOKEN}" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "{\"name\":\"${REPO_NAME}\",\"private\":false,\"auto_init\":true,\"description\":\"FFmpeg worker - Rendi.dev compatible\"}")

    if echo "$CREATE_RESPONSE" | grep -q "name.*${REPO_NAME}"; then
        echo "  ✅ تم إنشاء المستودع"
    else
        echo "  ⚠️ المستودع موجود مسبقاً"
    fi

    # استنساخ المستودع
    echo "  ⏳ استنساخ المستودع..."
    rm -rf "temp_${REPO_NAME}"
    git clone "https://${GH_USERNAME}:${GH_TOKEN}@github.com/${GH_USERNAME}/${REPO_NAME}.git" "temp_${REPO_NAME}" --quiet 2>/dev/null
    cd "temp_${REPO_NAME}"

    # إنشاء workflow للـ FFmpeg render
    echo "  ⏳ إنشاء render workflow..."
    mkdir -p .github/workflows

    cat > .github/workflows/render-video.yml << 'WORKFLOWEOF'
name: Render Video
on:
  workflow_dispatch:
    inputs:
      ffmpeg_command: {required: true, type: string}
      input_files_json: {required: false, type: string, default: '{}'}
      output_files_json: {required: true, type: string}
      max_command_run_seconds: {required: false, type: string, default: '300'}
      vcpu_count: {required: false, type: string, default: '8'}
      metadata_json: {required: false, type: string, default: '{}'}
      command_id: {required: true, type: string}
      input_compressed_folder: {required: false, type: string, default: ''}
jobs:
  render:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v3
      - run: sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg curl unzip
      - uses: actions/setup-node@v3
        with: {node-version: '18'}
      - run: npm init -y && npm install @aws-sdk/client-s3
      - env:
          FFMPEG_COMMAND: ${{ github.event.inputs.ffmpeg_command }}
          INPUT_FILES_JSON: ${{ github.event.inputs.input_files_json }}
          OUTPUT_FILES_JSON: ${{ github.event.inputs.output_files_json }}
          MAX_RUN_SECONDS: ${{ github.event.inputs.max_command_run_seconds }}
          VCPU_COUNT: ${{ github.event.inputs.vcpu_count }}
          METADATA_JSON: ${{ github.event.inputs.metadata_json }}
          COMMAND_ID: ${{ github.event.inputs.command_id }}
          INPUT_COMPRESSED_FOLDER: ${{ github.event.inputs.input_compressed_folder }}
          R2_ACCESS_KEY: ${{ secrets.R2_ACCESS_KEY }}
          R2_SECRET_KEY: ${{ secrets.R2_SECRET_KEY }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
          R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
        run: |
          cat > render.js << 'RENDEREOF'
          import { execSync } from 'child_process';
          import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
          import fs from 'fs';
          import path from 'path';
          import { fileURLToPath } from 'url';
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          async function render() {
            const env = process.env;
            const tempDir = path.join(__dirname, 'temp');
            fs.mkdirSync(tempDir, { recursive: true });
            try {
              const inputFiles = JSON.parse(env.INPUT_FILES_JSON || '{}');
              const outputFiles = JSON.parse(env.OUTPUT_FILES_JSON || '{}');
              let cmd = env.FFMPEG_COMMAND;
              const downloaded = {};
              for (const [k, url] of Object.entries(inputFiles)) {
                if (url && url.startsWith('http')) {
                  const ext = path.extname(new URL(url).pathname) || '.mp4';
                  const lp = path.join(tempDir, `${k}${ext}`);
                  for (let a = 1; a <= 3; a++) {
                    try { execSync(`curl -L --retry 3 --max-time 120 -o "${lp}" "${url}"`, { stdio: 'inherit', timeout: 180000 }); downloaded[k] = lp; break; }
                    catch { if (a === 3) throw new Error(`Failed to download ${k}`); await new Promise(r => setTimeout(r, 2000)); }
                  }
                }
              }
              if (env.INPUT_COMPRESSED_FOLDER) {
                const zp = path.join(tempDir, 'input.zip');
                execSync(`curl -L -o "${zp}" "${env.INPUT_COMPRESSED_FOLDER}"`, { stdio: 'inherit' });
                execSync(`unzip -o "${zp}" -d ${tempDir}/input_folder`, { stdio: 'inherit' });
                downloaded['input_folder'] = path.join(tempDir, 'input_folder');
              }
              for (const [k, lp] of Object.entries(downloaded)) cmd = cmd.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), lp);
              const outputs = {};
              for (const [k, fn] of Object.entries(outputFiles)) {
                const op = path.join(tempDir, fn);
                outputs[k] = op;
                cmd = cmd.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), op);
              }
              execSync(cmd, { stdio: 'inherit', timeout: (parseInt(env.MAX_RUN_SECONDS) + 30) * 1000 });
              const s3 = new S3Client({ region: 'auto', endpoint: env.R2_ENDPOINT, credentials: { accessKeyId: env.R2_ACCESS_KEY, secretAccessKey: env.R2_SECRET_KEY }, forcePathStyle: true });
              for (const [k, op] of Object.entries(outputs)) {
                if (!fs.existsSync(op)) continue;
                const fn = path.basename(op);
                await s3.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: fn, Body: fs.readFileSync(op), ContentType: 'video/mp4' }));
                console.log(`VIDEO_URL_RESULT_${k}=${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${fn}`);
              }
            } catch (e) { console.error(e); process.exit(1); }
            finally { if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true }); }
          }
          render();
          RENDEREOF
          node render.js
WORKFLOWEOF

    echo "  ✅ تم إنشاء render workflow"

    # إنشاء workflow للـ transcribe
    echo "  ⏳ إنشاء transcribe workflow..."

        cat > .github/workflows/transcribe-audio.yml << 'TREOF'
name: Transcribe Audio
on:
  workflow_dispatch:
    inputs:
      audio_url:
        required: false
        type: string
        default: ''
      audio_base64:
        required: false
        type: string
        default: ''
      language:
        required: false
        type: string
        default: 'auto'
      model_size:
        required: false
        type: string
        default: 'tiny'
      word_timestamps:
        required: false
        type: string
        default: 'true'
      output_files_json:
        required: true
        type: string
      command_id:
        required: true
        type: string

jobs:
  transcribe:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    container:
      image: mohammedaligrh/audio-engine:v1
      options: --user root
    steps:
      - uses: actions/checkout@v3

      - name: Download audio file
        run: |
          mkdir -p /tmp/audio_in
          mkdir -p /tmp/audio_out

          AUDIO_URL="${{ github.event.inputs.audio_url }}"
          AUDIO_B64="${{ github.event.inputs.audio_base64 }}"

          if [ -n "$AUDIO_URL" ]; then
            echo "Downloading audio from URL..."
            # Extract filename from URL for proper extension detection
            FILENAME=$(basename "$AUDIO_URL" | cut -d'?' -f1)
            if [ -n "$FILENAME" ] && [ "$FILENAME" != "download" ]; then
              curl -L --retry 3 --max-time 300 -o "/tmp/audio_in/$FILENAME" \
                "$AUDIO_URL" || { echo "Download failed"; exit 1; }
              ls -lh "/tmp/audio_in/$FILENAME"
            else
              curl -L --retry 3 --max-time 300 -o /tmp/audio_in/input_audio \
                "$AUDIO_URL" || { echo "Download failed"; exit 1; }
            fi
          elif [ -n "$AUDIO_B64" ]; then
            echo "Decoding base64 audio..."
            echo "$AUDIO_B64" | base64 -d > /tmp/audio_in/input_audio || { echo "Base64 decode failed"; exit 1; }
          else
            echo "No audio source provided"
            exit 1
          fi

          echo "Audio downloaded successfully"

      - name: Detect format and convert to 16kHz WAV
        run: |
          echo "=== Finding input file ==="
          INPUT_FILE=$(ls /tmp/audio_in/* 2>/dev/null | head -1)
          echo "Input: $INPUT_FILE"

          echo "=== File type ==="
          file "$INPUT_FILE" || true

          echo "=== FFprobe debug ==="
          ffprobe -v error -show_format -show_streams -print_format json "$INPUT_FILE" || true

          echo "=== Hex header ==="
          HEX=$(xxd -l 16 "$INPUT_FILE" 2>/dev/null | head -1 || od -A x -t x1 -N 16 "$INPUT_FILE" 2>/dev/null | head -1)
          echo "$HEX"

          echo "=== Converting to 16kHz mono WAV ==="
          # Attempt 1: Normal
          ffmpeg -y -v error -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0

          # Attempt 2: Detect via file extension
          EXT=$(file "$INPUT_FILE" | grep -oiE '(mp3|ogg|opus|wav|flac|aac|m4a|wma|webm|mp4|mov|avi|mkv)' | head -1)
          if [ -n "$EXT" ]; then
            cp "$INPUT_FILE" "/tmp/audio_in/input.$EXT"
            ffmpeg -y -v error -i "/tmp/audio_in/input.$EXT" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          fi

          # Attempt 3: Magic bytes
          case "$HEX" in
            *"fff"*) cp "$INPUT_FILE" /tmp/audio_in/input.mp3; ffmpeg -y -v error -i /tmp/audio_in/input.mp3 -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"4f676753"*) cp "$INPUT_FILE" /tmp/audio_in/input.ogg; ffmpeg -y -v error -i /tmp/audio_in/input.ogg -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"52494646"*) cp "$INPUT_FILE" /tmp/audio_in/input.wav; ffmpeg -y -v error -i /tmp/audio_in/input.wav -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"664c6143"*) cp "$INPUT_FILE" /tmp/audio_in/input.flac; ffmpeg -y -v error -i /tmp/audio_in/input.flac -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"1a45dfa3"*) cp "$INPUT_FILE" /tmp/audio_in/input.mkv; ffmpeg -y -v error -i /tmp/audio_in/input.mkv -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"66747970"*) cp "$INPUT_FILE" /tmp/audio_in/input.m4a; ffmpeg -y -v error -i /tmp/audio_in/input.m4a -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
          esac

          # Attempt 4: -f auto
          ffmpeg -y -v error -f auto -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0

          # Attempt 5: ignore_unknown
          ffmpeg -y -v error -ignore_unknown -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0

          # Attempt 6: force wav demuxer
          ffmpeg -y -v error -f wav -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0

          # Attempt 7: raw PCM s16le
          ffmpeg -y -v error -f s16le -ar 44100 -ac 2 -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0

          echo "=== ALL CONVERSION ATTEMPTS FAILED ==="
          ls -la /tmp/audio_in/
          file "$INPUT_FILE"
          echo "Hex dump:"
          xxd "$INPUT_FILE" 2>/dev/null | head -5 || od -A x -t x1z "$INPUT_FILE" 2>/dev/null | head -5
          echo "File size: $(stat --format=%s "$INPUT_FILE" 2>/dev/null || wc -c < "$INPUT_FILE")"
          exit 1

      - name: Extract detailed audio metadata with FFprobe
        id: audio_metadata
        run: |
          echo "Extracting audio metadata..."

          # Full probe info
          ffprobe -v quiet -show_format -show_streams \
            -print_format json /tmp/audio_in/converted.wav > /tmp/audio_metadata.json

          # Silence detection
          echo "Detecting silence segments..."
          ffmpeg -i /tmp/audio_in/converted.wav -af silencedetect=noise=-30dB:d=0.3 \
            -f null - 2>&1 | tee /tmp/silence_raw.txt

          # Parse silence using base64-encoded Python
          echo 'aW1wb3J0IGpzb24sIHJlLCBzeXMKCndpdGggb3BlbignL3RtcC9zaWxlbmNlX3Jhdy50eHQnKSBhcyBmOgogICAgdGV4dCA9IGYucmVhZCgpCgpzaWxlbmNlX3N0YXJ0ID0gcmUuZmluZGFsbChyJ3NpbGVuY2Vfc3RhcnQ6XHMqKFtcZC5dKyknLCB0ZXh0KQpzaWxlbmNlX2VuZCA9IHJlLmZpbmRhbGwocidzaWxlbmNlX2VuZDpccyooW1xkLl0rKScsIHRleHQpCnNpbGVuY2VfZHVyYXRpb24gPSByZS5maW5kYWxsKHInc2lsZW5jZV9kdXJhdGlvbjpccyooW1xkLl0rKScsIHRleHQpCgpzaWxlbmNlcyA9IFtdCmZvciBpIGluIHJhbmdlKGxlbihzaWxlbmNlX3N0YXJ0KSk6CiAgICBzaWxlbmNlcy5hcHBlbmQoewogICAgICAgICJzdGFydCI6IHJvdW5kKGZsb2F0KHNpbGVuY2Vfc3RhcnRbaV0pLCAzKSwKICAgICAgICAiZW5kIjogcm91bmQoZmxvYXQoc2lsZW5jZV9lbmRbaV0pLCAzKSBpZiBpIDwgbGVuKHNpbGVuY2VfZW5kKSBlbHNlIHJvdW5kKGZsb2F0KHNpbGVuY2Vfc3RhcnRbaV0pICsgMC4zLCAzKSwKICAgICAgICAiZHVyYXRpb24iOiByb3VuZChmbG9hdChzaWxlbmNlX2R1cmF0aW9uW2ldKSwgMykgaWYgaSA8IGxlbihzaWxlbmNlX2R1cmF0aW9uKSBlbHNlIDAuMwogICAgfSkKCndpdGggb3BlbignL3RtcC9zaWxlbmNlX2dhcHMuanNvbicsICd3JykgYXMgZjoKICAgIGpzb24uZHVtcCh7InNpbGVuY2VfZ2FwcyI6IHNpbGVuY2VzLCAidG90YWxfc2lsZW5jZV9zZWNvbmRzIjogcm91bmQoc3VtKHNbImR1cmF0aW9uIl0gZm9yIHMgaW4gc2lsZW5jZXMpLCAzKX0sIGYpCgpwcmludChmIkZvdW5kIHtsZW4oc2lsZW5jZXMpfSBzaWxlbmNlIGdhcHMiKQo=' | base64 -d | python3

      - name: Run Whisper Speech-to-Text
        id: whisper
        run: |
          MODEL="${{ github.event.inputs.model_size }}"
          LANG="${{ github.event.inputs.language }}"
          WORD_TS="${{ github.event.inputs.word_timestamps }}"

          echo "Running Whisper (model=$MODEL, language=$LANG)..."
          echo "First run downloads the model (~150MB for 'base')"

          echo 'aW1wb3J0IHdoaXNwZXIsIGpzb24sIHN5cwoKbW9kZWxfbmFtZSA9IHN5cy5hcmd2WzFdCmxhbmcgPSBzeXMuYXJndlsyXSBpZiBzeXMuYXJndlsyXSAhPSAnYXV0bycgZWxzZSBOb25lCndvcmRfdHMgPSBzeXMuYXJndlszXS5sb3dlcigpID09ICd0cnVlJwoKbW9kZWwgPSB3aGlzcGVyLmxvYWRfbW9kZWwobW9kZWxfbmFtZSkKCnJlc3VsdCA9IG1vZGVsLnRyYW5zY3JpYmUoCiAgICAnL3RtcC9hdWRpb19pbi9jb252ZXJ0ZWQud2F2JywKICAgIGxhbmd1YWdlPWxhbmcsCiAgICB3b3JkX3RpbWVzdGFtcHM9d29yZF90cywKICAgIHZlcmJvc2U9RmFsc2UKKQoKd2l0aCBvcGVuKCcvdG1wL3doaXNwZXJfcmVzdWx0Lmpzb24nLCAndycpIGFzIGY6CiAgICBqc29uLmR1bXAocmVzdWx0LCBmLCBlbnN1cmVfYXNjaWk9RmFsc2UsIGluZGVudD0yKQoKd29yZHMgPSBbXQpmb3Igc2VnIGluIHJlc3VsdC5nZXQoJ3NlZ21lbnRzJywgW10pOgogICAgZm9yIHcgaW4gc2VnLmdldCgnd29yZHMnLCBbXSk6CiAgICAgICAgd29yZHMuYXBwZW5kKHsKICAgICAgICAgICAgJ3dvcmQnOiB3LmdldCgnd29yZCcsICcnKS5zdHJpcCgpLAogICAgICAgICAgICAnc3RhcnQnOiByb3VuZCh3LmdldCgnc3RhcnQnLCAwKSwgMyksCiAgICAgICAgICAgICdlbmQnOiByb3VuZCh3LmdldCgnZW5kJywgMCksIDMpLAogICAgICAgICAgICAnY29uZmlkZW5jZSc6IHJvdW5kKHcuZ2V0KCdwcm9iYWJpbGl0eScsIHcuZ2V0KCdjb25maWRlbmNlJywgMCkpLCAzKQogICAgICAgIH0pCgppZiBub3Qgd29yZHM6CiAgICBmb3Igc2VnIGluIHJlc3VsdC5nZXQoJ3NlZ21lbnRzJywgW10pOgogICAgICAgIHdvcmRzLmFwcGVuZCh7CiAgICAgICAgICAgICd3b3JkJzogc2VnLmdldCgndGV4dCcsICcnKS5zdHJpcCgpLAogICAgICAgICAgICAnc3RhcnQnOiByb3VuZChzZWcuZ2V0KCdzdGFydCcsIDApLCAzKSwKICAgICAgICAgICAgJ2VuZCc6IHJvdW5kKHNlZy5nZXQoJ2VuZCcsIDApLCAzKSwKICAgICAgICAgICAgJ2NvbmZpZGVuY2UnOiByb3VuZChzZWcuZ2V0KCdjb25maWRlbmNlJywgMCksIDMpCiAgICAgICAgfSkKCmZvciBpLCB3IGluIGVudW1lcmF0ZSh3b3Jkcyk6CiAgICB3WydpbmRleCddID0gaQoKcHJpbnQoZidUcmFuc2NyaWJlZCB7bGVuKHdvcmRzKX0gd29yZHMvc2VnbWVudHMnKQpwcmludChmJ0xhbmd1YWdlIGRldGVjdGVkOiB7cmVzdWx0LmdldCgibGFuZ3VhZ2UiLCAidW5rbm93biIpfScpCnByaW50KGYnRlVMTF9UUkFOU0NSSVBUOiAnICsganNvbi5kdW1wcyhyZXN1bHQuZ2V0KCd0ZXh0JywgJycpLCBlbnN1cmVfYXNjaWk9RmFsc2UpKQoKd2l0aCBvcGVuKCcvdG1wL3dvcmRzX3RpbWVzdGFtcHMuanNvbicsICd3JykgYXMgZjoKICAgIGpzb24uZHVtcCh3b3JkcywgZiwgZW5zdXJlX2FzY2lpPUZhbHNlLCBpbmRlbnQ9MikKCndpdGggb3BlbignL3RtcC9kZXRlY3RlZF9sYW5nLmpzb24nLCAndycpIGFzIGY6CiAgICBqc29uLmR1bXAoeydsYW5ndWFnZSc6IHJlc3VsdC5nZXQoJ2xhbmd1YWdlJywgJycpLCAnc2VnbWVudHMnOiBsZW4ocmVzdWx0LmdldCgnc2VnbWVudHMnLCBbXSkpfSwgZikK' | base64 -d | python3 - "$MODEL" "$LANG" "$WORD_TS" || {
            echo "Whisper failed";
            cat /tmp/whisper_result.json 2>/dev/null;
            exit 1;
          }

          echo "Transcription complete"

      - name: Build final transcript JSON
        id: build_json
        run: |
          echo "Building final transcript JSON..."
          CID="${{ github.event.inputs.command_id }}"
          MODEL="${{ github.event.inputs.model_size }}"
          echo 'aW1wb3J0IGpzb24sIG9zLCByZSwgc3lzCgpjb21tYW5kX2lkID0gc3lzLmFyZ3ZbMV0KbW9kZWxfc2l6ZSA9IHN5cy5hcmd2WzJdCgp3aXRoIG9wZW4oJy90bXAvYXVkaW9fbWV0YWRhdGEuanNvbicpIGFzIGY6CiAgICBhdWRpb19pbmZvID0ganNvbi5sb2FkKGYpCgp3aXRoIG9wZW4oJy90bXAvd2hpc3Blcl9yZXN1bHQuanNvbicpIGFzIGY6CiAgICB3aGlzcGVyX3Jlc3VsdCA9IGpzb24ubG9hZChmKQoKd2l0aCBvcGVuKCcvdG1wL3dvcmRzX3RpbWVzdGFtcHMuanNvbicpIGFzIGY6CiAgICB3b3JkcyA9IGpzb24ubG9hZChmKQoKd2l0aCBvcGVuKCcvdG1wL3NpbGVuY2VfZ2Fwcy5qc29uJykgYXMgZjoKICAgIHNpbGVuY2VfZGF0YSA9IGpzb24ubG9hZChmKQoKd2l0aCBvcGVuKCcvdG1wL2RldGVjdGVkX2xhbmcuanNvbicpIGFzIGY6CiAgICBsYW5nX2RhdGEgPSBqc29uLmxvYWQoZikKCmZtdCA9IGF1ZGlvX2luZm8uZ2V0KCdmb3JtYXQnLCB7fSkKc3RyZWFtcyA9IGF1ZGlvX2luZm8uZ2V0KCdzdHJlYW1zJywgW10pCmF1ZGlvX3N0cmVhbSA9IG5leHQoKHMgZm9yIHMgaW4gc3RyZWFtcyBpZiBzLmdldCgnY29kZWNfdHlwZScpID09ICdhdWRpbycpLCB7fSkKCmR1cmF0aW9uID0gZmxvYXQoZm10LmdldCgnZHVyYXRpb24nLCBhdWRpb19zdHJlYW0uZ2V0KCdkdXJhdGlvbicsIDApKSkKCnRvdGFsX3NwZWVjaCA9IGR1cmF0aW9uIC0gc2lsZW5jZV9kYXRhWyd0b3RhbF9zaWxlbmNlX3NlY29uZHMnXQpzcGVha2luZ19yYXRlID0gbGVuKHdvcmRzKSAvICh0b3RhbF9zcGVlY2ggLyA2MCkgaWYgdG90YWxfc3BlZWNoID4gMCBlbHNlIDAKCnNlZ21lbnRzID0gW10KZm9yIHNlZyBpbiB3aGlzcGVyX3Jlc3VsdC5nZXQoJ3NlZ21lbnRzJywgW10pOgogICAgc2VnbWVudHMuYXBwZW5kKHsKICAgICAgICAnaWQnOiBzZWcuZ2V0KCdpZCcsIDApLAogICAgICAgICdzdGFydCc6IHJvdW5kKHNlZy5nZXQoJ3N0YXJ0JywgMCksIDMpLAogICAgICAgICdlbmQnOiByb3VuZChzZWcuZ2V0KCdlbmQnLCAwKSwgMyksCiAgICAgICAgJ3RleHQnOiBzZWcuZ2V0KCd0ZXh0JywgJycpLnN0cmlwKCksCiAgICAgICAgJ2NvbmZpZGVuY2UnOiByb3VuZChzZWcuZ2V0KCdjb25maWRlbmNlJywgMCksIDMpCiAgICB9KQoKcmVwb3J0ID0gewogICAgInR5cGUiOiAidHJhbnNjcmlwdGlvbiIsCiAgICAiY29tbWFuZF9pZCI6IGNvbW1hbmRfaWQsCiAgICAidHJhbnNjcmlwdCI6IHsKICAgICAgICAiZnVsbF90ZXh0Ijogd2hpc3Blcl9yZXN1bHQuZ2V0KCd0ZXh0JywgJycpLnN0cmlwKCksCiAgICAgICAgImxhbmd1YWdlIjogbGFuZ19kYXRhLmdldCgnbGFuZ3VhZ2UnLCAndW5rbm93bicpLAogICAgICAgICJtb2RlbCI6IG1vZGVsX3NpemUsCiAgICAgICAgInNlZ21lbnRzIjogc2VnbWVudHMsCiAgICAgICAgIndvcmRzIjogd29yZHMKICAgIH0sCiAgICAiYXVkaW9fbWV0YWRhdGEiOiB7CiAgICAgICAgImR1cmF0aW9uX3NlY29uZHMiOiByb3VuZChkdXJhdGlvbiwgMyksCiAgICAgICAgInNhbXBsZV9yYXRlIjogaW50KGF1ZGlvX3N0cmVhbS5nZXQoJ3NhbXBsZV9yYXRlJywgMCkpLAogICAgICAgICJjaGFubmVscyI6IGludChhdWRpb19zdHJlYW0uZ2V0KCdjaGFubmVscycsIDEpKSwKICAgICAgICAiY29kZWMiOiBhdWRpb19zdHJlYW0uZ2V0KCdjb2RlY19uYW1lJywgJ3Vua25vd24nKSwKICAgICAgICAiYml0X3JhdGUiOiBpbnQoZm10LmdldCgnYml0X3JhdGUnLCAwKSksCiAgICAgICAgImZvcm1hdF9uYW1lIjogZm10LmdldCgnZm9ybWF0X25hbWUnLCAndW5rbm93bicpLAogICAgICAgICJzaXplX2J5dGVzIjogaW50KGZtdC5nZXQoJ3NpemUnLCAwKSkKICAgIH0sCiAgICAic3BlZWNoX2FuYWx5c2lzIjogewogICAgICAgICJ0b3RhbF93b3JkcyI6IGxlbih3b3JkcyksCiAgICAgICAgInRvdGFsX3NwZWVjaF9zZWNvbmRzIjogcm91bmQodG90YWxfc3BlZWNoLCAzKSwKICAgICAgICAidG90YWxfc2lsZW5jZV9zZWNvbmRzIjogcm91bmQoc2lsZW5jZV9kYXRhWyd0b3RhbF9zaWxlbmNlX3NlY29uZHMnXSwgMyksCiAgICAgICAgInNwZWVjaF90b19zaWxlbmNlX3JhdGlvIjogcm91bmQodG90YWxfc3BlZWNoIC8gc2lsZW5jZV9kYXRhWyd0b3RhbF9zaWxlbmNlX3NlY29uZHMnXSwgMikgaWYgc2lsZW5jZV9kYXRhWyd0b3RhbF9zaWxlbmNlX3NlY29uZHMnXSA+IDAgZWxzZSBOb25lLAogICAgICAgICJzcGVha2luZ19yYXRlX3dwbSI6IHJvdW5kKHNwZWFraW5nX3JhdGUsIDEpLAogICAgICAgICJhdmVyYWdlX3dvcmRfY29uZmlkZW5jZSI6IHJvdW5kKHN1bSh3LmdldCgnY29uZmlkZW5jZScsIDEpIGZvciB3IGluIHdvcmRzKSAvIGxlbih3b3JkcyksIDMpIGlmIHdvcmRzIGVsc2UgMCwKICAgICAgICAic2lsZW5jZV9nYXBzIjogc2lsZW5jZV9kYXRhWydzaWxlbmNlX2dhcHMnXQogICAgfQp9CgpvdXRwdXRfcGF0aCA9ICcvdG1wL2ZpbmFsX3RyYW5zY3JpcHQuanNvbicKd2l0aCBvcGVuKG91dHB1dF9wYXRoLCAndycsIGVuY29kaW5nPSd1dGYtOCcpIGFzIGY6CiAgICBqc29uLmR1bXAocmVwb3J0LCBmLCBlbnN1cmVfYXNjaWk9RmFsc2UsIGluZGVudD0yKQoKcHJpbnQoZiJSZXBvcnQgYnVpbHQ6IHtsZW4od29yZHMpfSB3b3Jkcywge2xlbihzZWdtZW50cyl9IHNlZ21lbnRzLCB7cm91bmQoZHVyYXRpb24sIDEpfXMgZHVyYXRpb24iKQo=' | base64 -d | python3 - "$CID" "$MODEL"

      - name: Upload result to Cloudflare R2
        run: |
          npm init -y 2>/dev/null; npm install --prefer-offline @aws-sdk/client-s3 2>&1 | tail -1

          node -e "
          const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
          const fs = require('fs');

          async function upload() {
            const s3 = new S3Client({
              region: 'auto',
              endpoint: process.env.R2_ENDPOINT,
              credentials: {
                accessKeyId: process.env.R2_ACCESS_KEY,
                secretAccessKey: process.env.R2_SECRET_KEY
              },
              forcePathStyle: true
            });

            const outputFiles = JSON.parse(process.env.OUTPUT_FILES_JSON || '{}');
            const reportPath = '/tmp/final_transcript.json';
            const reportData = fs.readFileSync(reportPath, 'utf-8');

            for (const [key, filename] of Object.entries(outputFiles)) {
              await s3.send(new PutObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: filename,
                Body: reportData,
                ContentType: 'application/json'
              }));
              const url = process.env.R2_PUBLIC_URL.replace(/\/\$/, '') + '/' + filename;
              console.log('RESULT_URL_' + key + '=' + url);
              console.log('Transcript uploaded: ' + url);
            }

            const report = JSON.parse(reportData);
            const preview = report.transcript.full_text.substring(0, 200);
            console.log('TRANSCRIPT_PREVIEW: ' + preview);
            console.log('WORDS: ' + report.speech_analysis.total_words);
            console.log('LANGUAGE: ' + report.transcript.language);
            console.log('WPM: ' + report.speech_analysis.speaking_rate_wpm);
          }

          upload().catch(e => { console.error(e); process.exit(1); });
          "
        env:
          R2_ACCESS_KEY: ${{ secrets.R2_ACCESS_KEY }}
          R2_SECRET_KEY: ${{ secrets.R2_SECRET_KEY }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
          R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
          OUTPUT_FILES_JSON: ${{ github.event.inputs.output_files_json }}
TREOF


    echo "  ✅ تم إنشاء transcribe workflow"

    # إنشاء workflow للـ audio probe
    echo "  ⏳ إنشاء audio probe workflow..."

                cat > .github/workflows/audio-probe.yml << 'APEOF'
name: Audio Probe
on:
  workflow_dispatch:
    inputs:
      audio_url:
        required: false
        type: string
        default: ''
      audio_base64:
        required: false
        type: string
        default: ''
      output_files_json:
        required: true
        type: string
      command_id:
        required: true
        type: string

jobs:
  probe:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    container:
      image: mohammedaligrh/audio-engine:v1
      options: --user root
    steps:
      - uses: actions/checkout@v3

      - name: Download audio file
        run: |
          mkdir -p /tmp/audio_in
          if [ -n "${{ github.event.inputs.audio_url }}" ]; then
            FILENAME=$(basename "${{ github.event.inputs.audio_url }}" | cut -d'?' -f1)
            if [ -n "$FILENAME" ] && [ "$FILENAME" != "download" ]; then
              curl -L --retry 3 --max-time 120 -o "/tmp/audio_in/$FILENAME" "${{ github.event.inputs.audio_url }}"
            else
              curl -L --retry 3 --max-time 120 -o /tmp/audio_in/input_audio "${{ github.event.inputs.audio_url }}"
            fi
          elif [ -n "${{ github.event.inputs.audio_base64 }}" ]; then
            echo "${{ github.event.inputs.audio_base64 }}" | base64 -d > /tmp/audio_in/input_audio
          else
            echo "No audio source"; exit 1
          fi
          echo "Downloaded: $(ls /tmp/audio_in/)"

      - name: Convert to 16kHz WAV
        run: |
          INPUT_FILE=$(ls /tmp/audio_in/* 2>/dev/null | head -1)
          echo "Input: $INPUT_FILE"
          file "$INPUT_FILE"
          ffprobe -v error -show_format -show_streams -print_format json "$INPUT_FILE" || true
          # Try 1: normal
          ffmpeg -y -v error -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          # Try 2: force format detection using file probe
          EXT=$(file "$INPUT_FILE" | grep -oiE '(mp3|ogg|opus|wav|flac|aac|m4a|wma|webm|mp4|mov|avi|mkv)' | head -1)
          if [ -n "$EXT" ]; then
            cp "$INPUT_FILE" "/tmp/audio_in/input.$EXT"
            ffmpeg -y -v error -i "/tmp/audio_in/input.$EXT" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          fi
          # Try 3: force format based on known magic bytes (PE header detection)
          HEX=$(xxd -l 16 "$INPUT_FILE" 2>/dev/null | head -1 || od -A x -t x1 -N 16 "$INPUT_FILE" 2>/dev/null | head -1)
          echo "Hex header: $HEX"
          case "$(echo "$HEX" | head -c 200)" in
            *"fff"*) cp "$INPUT_FILE" /tmp/audio_in/input.mp3; ffmpeg -y -v error -i /tmp/audio_in/input.mp3 -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"4f676753"*) cp "$INPUT_FILE" /tmp/audio_in/input.ogg; ffmpeg -y -v error -i /tmp/audio_in/input.ogg -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"52494646"*) cp "$INPUT_FILE" /tmp/audio_in/input.wav; ffmpeg -y -v error -i /tmp/audio_in/input.wav -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"664c6143"*) cp "$INPUT_FILE" /tmp/audio_in/input.flac; ffmpeg -y -v error -i /tmp/audio_in/input.flac -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"1a45dfa3"*) cp "$INPUT_FILE" /tmp/audio_in/input.mkv; ffmpeg -y -v error -i /tmp/audio_in/input.mkv -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"0000001c66747970"*) cp "$INPUT_FILE" /tmp/audio_in/input.m4a; ffmpeg -y -v error -i /tmp/audio_in/input.m4a -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"3026b2758e66"*) cp "$INPUT_FILE" /tmp/audio_in/input.m4a; ffmpeg -y -v error -i /tmp/audio_in/input.m4a -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
            *"464c56"*) cp "$INPUT_FILE" /tmp/audio_in/input.flv; ffmpeg -y -v error -i /tmp/audio_in/input.flv -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0 ;;
          esac
          # Try 4: -f auto
          ffmpeg -y -v error -f auto -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          # Try 5: ignore_unknown
          ffmpeg -y -v error -ignore_unknown -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          # Try 6: force WAV input (maybe it's already PCM)
          ffmpeg -y -v error -f wav -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          # Try 7: raw PCM
          ffmpeg -y -v error -f s16le -ar 44100 -ac 2 -i "$INPUT_FILE" -ar 16000 -ac 1 /tmp/audio_in/converted.wav && echo "OK" && exit 0
          echo "=== ALL ATTEMPTS FAILED ==="
          exit 1

      - name: Extract audio metadata (ffprobe)
        run: |
          ffprobe -v quiet -show_format -show_streams \
            -print_format json /tmp/audio_in/converted.wav > /tmp/audio_metadata.json
          echo "METADATA_DONE"

      - name: Detect silence + loudness
        id: audio_analysis
        run: |
          ffmpeg -i /tmp/audio_in/converted.wav -af silencedetect=noise=-30dB:d=0.3 \
            -f null - 2>&1 | tee /tmp/silence_raw.txt
          ffmpeg -i /tmp/audio_in/converted.wav -af ebur128=framelog=verbose \
            -f null - 2>&1 | tee /tmp/loudness_raw.txt || true
          echo "ANALYSIS_RAW_DONE"

      - name: Run probe analysis
        run: |
          CID="${{ github.event.inputs.command_id }}"
          INPUT_FILE=$(ls /tmp/audio_in/converted.wav 2>/dev/null || ls /tmp/audio_in/* 2>/dev/null | head -1)
          echo 'aW1wb3J0IGpzb24sIHJlLCBzeXMKQ0lEID0gc3lzLmFyZ3ZbMV0Kcz1vcGVuKCcvdG1wL3NpbGVuY2VfcmF3LnR4dCcpLnJlYWQoKQpzcz1yZS5maW5kYWxsKHInc2lsZW5jZV9zdGFydDpccyooW1xkLl0rKScscykKc2Q9cmUuZmluZGFsbChyJ3NpbGVuY2VfZHVyYXRpb246XHMqKFtcZC5dKyknLHMpCmdhcHM9W10KZm9yIGkgaW4gcmFuZ2UobGVuKHNzKSk6CiAgICBnYXBzLmFwcGVuZCh7J3N0YXJ0Jzpyb3VuZChmbG9hdChzc1tpXSksMyksJ2VuZCc6cm91bmQoZmxvYXQoc3NbaV0pK2Zsb2F0KHNkW2ldKSBpZiBpPGxlbihzZCkgZWxzZSBmbG9hdChzc1tpXSkrMC4zLDMpLCdkdXJhdGlvbic6cm91bmQoZmxvYXQoc2RbaV0pIGlmIGk8bGVuKHNkKSBlbHNlIDAuMywzKX0pCmw9b3BlbignL3RtcC9sb3VkbmVzc19yYXcudHh0JykucmVhZCgpCmludGc9cmUuc2VhcmNoKHInSW50ZWdyYXRlZCBsb3VkbmVzczpccyooW1wtXGQuXSspXHMqTFVGUycsbCkKbHI9cmUuc2VhcmNoKHInTG91ZG5lc3MgcmFuZ2U6XHMqKFtcZC5dKylccypMVScsbCkKcGs9cmUuc2VhcmNoKHInUGVhazpccyooW1wtXGQuXSspXHMqZEJGUycsbCkKbT1qc29uLmxvYWQob3BlbignL3RtcC9hdWRpb19tZXRhZGF0YS5qc29uJykpCmFzXz1uZXh0KChzIGZvciBzIGluIG0uZ2V0KCdzdHJlYW1zJyxbXSkgaWYgcy5nZXQoJ2NvZGVjX3R5cGUnKT09J2F1ZGlvJykse30pCmR1cj1mbG9hdChtLmdldCgnZm9ybWF0Jyx7fSkuZ2V0KCdkdXJhdGlvbicsYXNfLmdldCgnZHVyYXRpb24nLDApKSkKdHNpbD1yb3VuZChzdW0oZ1snZHVyYXRpb24nXSBmb3IgZyBpbiBnYXBzKSwzKQp0c3A9cm91bmQoZHVyLXRzaWwsMykKc3I9cm91bmQodHNwL3RzaWwsMikgaWYgdHNpbD4wIGVsc2UgTm9uZQpyZj0xLjAKaWYgc3I6CiAgICBpZiBzcjwxLjA6cmY9MC42CiAgICBlbGlmIHNyPDIuMDpyZj0wLjgKICAgIGVsaWYgc3I8NC4wOnJmPTEuMAogICAgZWxzZTpyZj0xLjMKd3BtPXJvdW5kKDE1MCpyZikKcmVwb3J0PXsndHlwZSc6J2F1ZGlvX3Byb2JlJywnY29tbWFuZF9pZCc6Q0lELCdhdWRpb19tZXRhZGF0YSc6eydkdXJhdGlvbl9zZWNvbmRzJzpyb3VuZChkdXIsMyksJ3NhbXBsZV9yYXRlJzppbnQoYXNfLmdldCgnc2FtcGxlX3JhdGUnLDApKSwnY2hhbm5lbHMnOmludChhc18uZ2V0KCdjaGFubmVscycsMSkpLCdjb2RlYyc6YXNfLmdldCgnY29kZWNfbmFtZScsJ3Vua25vd24nKSwnYml0X3JhdGUnOmludChtLmdldCgnZm9ybWF0Jyx7fSkuZ2V0KCdiaXRfcmF0ZScsYXNfLmdldCgnYml0X3JhdGUnLDApKSksJ2Zvcm1hdF9uYW1lJzptLmdldCgnZm9ybWF0Jyx7fSkuZ2V0KCdmb3JtYXRfbmFtZScsJ3Vua25vd24nKSwnc2l6ZV9ieXRlcyc6aW50KG0uZ2V0KCdmb3JtYXQnLHt9KS5nZXQoJ3NpemUnLDApKX0sJ3NwZWVjaF9hbmFseXNpcyc6eyd0b3RhbF9zcGVlY2hfc2Vjb25kcyc6dHNwLCd0b3RhbF9zaWxlbmNlX3NlY29uZHMnOnRzaWwsJ3NwZWVjaF9kZW5zaXR5X3BlcmNlbnQnOnJvdW5kKHRzcC9kdXIqMTAwLDEpIGlmIGR1cj4wIGVsc2UgMCwnc3BlZWNoX3RvX3NpbGVuY2VfcmF0aW8nOnNyLCdlc3RpbWF0ZWRfc3BlYWtpbmdfcmF0ZV93cG0nOndwbSwnZXN0aW1hdGVkX3NwZWFraW5nX3JhdGVfbGFiZWwnOidzbG93JyBpZiB3cG08MTIwIGVsc2UgJ25vcm1hbCcgaWYgd3BtPDE4MCBlbHNlICdmYXN0Jywnbm90ZSc6J0VzdGltYXRlIGZyb20gc2lsZW5jZSBkZW5zaXR5LiBVc2UgUE9TVCAvdjEvdHJhbnNjcmliZSBmb3IgZXhhY3QgV1BNLicsJ3NpbGVuY2VfZ2Fwcyc6Z2Fwcywnc2lsZW5jZV9jb3VudCc6bGVuKGdhcHMpLCdzaWxlbmNlX2RlbnNpdHknOnJvdW5kKGxlbihnYXBzKS9kdXIqNjAsMSkgaWYgZHVyPjAgZWxzZSAwfSwnbG91ZG5lc3MnOnsnaW50ZWdyYXRlZF9sdWZzJzpyb3VuZChmbG9hdChpbnRnLmdyb3VwKDEpKSwxKSBpZiBpbnRnIGVsc2UgTm9uZSwnbG91ZG5lc3NfcmFuZ2VfbHUnOnJvdW5kKGZsb2F0KGxyLmdyb3VwKDEpKSwxKSBpZiBsciBlbHNlIE5vbmUsJ3BlYWtfZGJmcyc6cm91bmQoZmxvYXQocGsuZ3JvdXAoMSkpLDEpIGlmIHBrIGVsc2UgTm9uZX0gaWYgKGludGcgb3IgcGspIGVsc2UgTm9uZX0Kd2l0aCBvcGVuKCcvdG1wL2ZpbmFsX3Byb2JlLmpzb24nLCd3JykgYXMgZjoKICAgIGpzb24uZHVtcChyZXBvcnQsZixpbmRlbnQ9MikKcHJpbnQoZidSRVNVTFQ6e3JvdW5kKGR1ciwxKX1zfHtsZW4oZ2Fwcyl9Z2Fwc3x7d3BtfXdwbScpCg==' | base64 -d | python3 - "$CID" "$INPUT_FILE"

      - name: Upload result to Cloudflare R2
        run: |
          npm init -y 2>/dev/null; npm install --prefer-offline @aws-sdk/client-s3 2>&1 | tail -1
          node -e "
          const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3'),fs=require('fs');
          async function u(){
            const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY,secretAccessKey:process.env.R2_SECRET_KEY},forcePathStyle:true});
            const f=JSON.parse(process.env.OUTPUT_FILES_JSON||'{}'),d=fs.readFileSync('/tmp/final_probe.json','utf-8');
            for(const[k,fn]of Object.entries(f)){await s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:fn,Body:d,ContentType:'application/json'}));console.log('RESULT_URL_'+k+'='+process.env.R2_PUBLIC_URL.replace(/\/\$/,'')+'/'+fn);}
          }
          u().catch(e=>{console.error(e);process.exit(1)});"
        env:
          R2_ACCESS_KEY: ${{ secrets.R2_ACCESS_KEY }}
          R2_SECRET_KEY: ${{ secrets.R2_SECRET_KEY }}
          R2_BUCKET: ${{ secrets.R2_BUCKET }}
          R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
          R2_PUBLIC_URL: ${{ secrets.R2_PUBLIC_URL }}
          OUTPUT_FILES_JSON: ${{ github.event.inputs.output_files_json }}
APEOF


    echo "  ✅ تم إنشاء audio probe workflow"

    # رفع الملفات
    git add .
    git commit -m "Add render + transcribe workflows" --quiet
    git push origin main --quiet
    cd ..
    rm -rf "temp_${REPO_NAME}"

    echo "  ✅ تم رفع workflows"

    # محاولة إعداد الأسرار
    echo "  ⏳ إعداد الأسرار..."

    # استخدام GitHub CLI إذا موجود
    if command -v gh >/dev/null 2>&1; then
        echo "$GH_TOKEN" | gh auth login --with-token 2>/dev/null
        gh secret set R2_ACCESS_KEY -b"$R2_ACCESS_KEY" -R "${GH_USERNAME}/${REPO_NAME}" 2>/dev/null && echo "  ✅ R2_ACCESS_KEY" || echo "  ⚠️ يدوي"
        gh secret set R2_SECRET_KEY -b"$R2_SECRET_KEY" -R "${GH_USERNAME}/${REPO_NAME}" 2>/dev/null && echo "  ✅ R2_SECRET_KEY" || echo "  ⚠️ يدوي"
        gh secret set R2_BUCKET -b"$R2_BUCKET" -R "${GH_USERNAME}/${REPO_NAME}" 2>/dev/null && echo "  ✅ R2_BUCKET" || echo "  ⚠️ يدوي"
        gh secret set R2_ENDPOINT -b"$R2_ENDPOINT" -R "${GH_USERNAME}/${REPO_NAME}" 2>/dev/null && echo "  ✅ R2_ENDPOINT" || echo "  ⚠️ يدوي"
        gh secret set R2_PUBLIC_URL -b"$R2_PUBLIC_URL" -R "${GH_USERNAME}/${REPO_NAME}" 2>/dev/null && echo "  ✅ R2_PUBLIC_URL" || echo "  ⚠️ يدوي"
    else
        echo "  ⚠️ GitHub CLI غير موجود - ثبته من: https://cli.github.com"
        echo "  أو أضف الأسرار يدوياً من إعدادات المستودع"
    fi
done

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║   ✅ اكتمل الإعداد بنجاح!                                     ║"
echo "║                                                              ║"
echo "║   📋 الخطوات التالية:                                        ║"
echo "║                                                              ║"
echo "║   1. نشر api-server.js على Render:                           ║"
echo "║      - سجل في render.com                                     ║"
echo "║      - New Web Service                                       ║"
echo "║      - اختر هذا المستودع                                     ║"
echo "║      - Build: npm install                                    ║"
echo "║      - Start: node api-server.js                             ║"
echo "║                                                              ║"
echo "║   2. أضف متغيرات البيئة في Render:                           ║"
echo "║      GITHUB_TOKEN=${GH_TOKEN}                                ║"
echo "║      GITHUB_USERNAME=${GH_USERNAME}                          ║"
echo "║      R2_PUBLIC_URL=${R2_PUBLIC_URL}                          ║"
echo "║                                                              ║"
echo "║   3. في n8n غير الرابط فقط:                                  ║"
echo "║      https://api.rendi.dev                                   ║"
echo "║      إلى: https://your-app.onrender.com                      ║"
echo "║                                                              ║"
echo "║   4. 💬 **جديد** استخدم /v1/transcribe لتحويل الصوت إلى نص   ║"
echo "║      مع تحليلات كاملة (مدة الصوت، فترات الصمت، سرعة الكلام)   ║"
echo "║   5. 📊 **جديد** استخدم /v1/audio-probe لتحليل الصوت فقط      ║"
echo "║      بدون ترجمة - أسرع بكثير (فترات الصمت، الصوت، وغيرها)     ║"
echo "║                                                              ║"
echo "║   💰 التكلفة: 0$ للأبد                                       ║"
echo "║   ⚡ 18,000 دقيقة معالجة شهرياً                               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
