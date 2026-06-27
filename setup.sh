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
      audio_url: {required: false, type: string, default: ''}
      audio_base64: {required: false, type: string, default: ''}
      language: {required: false, type: string, default: 'auto'}
      model_size: {required: false, type: string, default: 'base'}
      word_timestamps: {required: false, type: string, default: 'true'}
      output_files_json: {required: true, type: string}
      command_id: {required: true, type: string}
jobs:
  transcribe:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v3
      - name: Install deps
        run: sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg curl unzip python3-pip python3-venv git build-essential
      - name: Set up Whisper
        run: python3 -m venv /opt/whisper-env && source /opt/whisper-env/bin/activate && pip3 install --quiet --upgrade pip && pip3 install --quiet openai-whisper tqdm
      - name: Download audio
        run: |
          mkdir -p /tmp/audio_in && AUDIO_URL="${{ github.event.inputs.audio_url }}" && AUDIO_B64="${{ github.event.inputs.audio_base64 }}"
          if [ -n "$AUDIO_URL" ]; then curl -L --retry 3 --max-time 300 -o /tmp/audio_in/input_audio "$AUDIO_URL"
          elif [ -n "$AUDIO_B64" ]; then echo "$AUDIO_B64" | base64 -d > /tmp/audio_in/input_audio; else echo "❌ No audio"; exit 1; fi
      - name: Convert to 16kHz WAV
        run: ffmpeg -y -i /tmp/audio_in/input_audio -ar 16000 -ac 1 /tmp/audio_in/converted.wav 2>/dev/null
      - name: Audio metadata + silence detection
        run: |
          ffprobe -v quiet -show_format -show_streams -print_format json /tmp/audio_in/converted.wav > /tmp/audio_metadata.json
          ffmpeg -i /tmp/audio_in/converted.wav -af silencedetect=noise=-30dB:d=0.3 -f null - 2>&1 | python3 -c "
import sys,json,re; t=sys.stdin.read()
s=re.findall(r'silence_start:\s*([\d.]+)',t)
d=re.findall(r'silence_duration:\s*([\d.]+)',t)
g=[{'start':round(float(s[i]),3),'end':round(float(s[i])+float(d[i]),3) if i<len(d) else round(float(s[i])+0.3,3),'duration':round(float(d[i]),3) if i<len(d) else 0.3} for i in range(len(s))]
json.dump({'silence_gaps':g,'total_silence_seconds':round(sum(x['duration'] for x in g),3)},open('/tmp/silence_gaps.json','w'))
print(f'Found {len(g)} silence gaps')"
      - name: Run Whisper STT
        run: |
          source /opt/whisper-env/bin/activate
          MODEL="${{ github.event.inputs.model_size }}" LANG="${{ github.event.inputs.language }}" WORD_TS="${{ github.event.inputs.word_timestamps }}"
          python3 -c "
import whisper,json
model=whisper.load_model(MODEL)
lang=None if '$LANG'=='auto' else '$LANG'
result=model.transcribe('/tmp/audio_in/converted.wav',language=lang,word_timestamps=$WORD_TS,verbose=False)
json.dump(result,open('/tmp/whisper_result.json','w'),ensure_ascii=False,indent=2)
words=[]
for seg in result.get('segments',[]):
  for w in seg.get('words',[]):
    words.append({'word':w.get('word','').strip(),'start':round(w.get('start',0),3),'end':round(w.get('end',0),3),'confidence':round(w.get('probability',w.get('confidence',0)),3)})
if not words:
  for seg in result.get('segments',[]):
    words.append({'word':seg.get('text','').strip(),'start':round(seg.get('start',0),3),'end':round(seg.get('end',0),3),'confidence':round(seg.get('confidence',0)),'index':seg.get('id',0)})
for i,w in enumerate(words): w['index']=i
json.dump(words,open('/tmp/words_timestamps.json','w'),ensure_ascii=False,indent=2)
json.dump({'language':result.get('language',''),'segments':len(result.get('segments',[]))},open('/tmp/detected_lang.json','w'))
print(f'{len(words)} words, lang={result.get(\"language\",\"\")}')"
      - name: Build final JSON
        run: |
          source /opt/whisper-env/bin/activate
          MODEL="${{ github.event.inputs.model_size }}"
          python3 -c "
import json
fmt=json.load(open('/tmp/audio_metadata.json'))
whisper=json.load(open('/tmp/whisper_result.json'))
words=json.load(open('/tmp/words_timestamps.json'))
silence=json.load(open('/tmp/silence_gaps.json'))
lang_d=json.load(open('/tmp/detected_lang.json'))
astream=next((s for s in fmt.get('streams',[]) if s.get('codec_type')=='audio'),{})
dur=float(fmt.get('format',{}).get('duration',astream.get('duration',0)))
tspeech=dur-silence['total_silence_seconds']
wpm=len(words)/(tspeech/60) if tspeech>0 else 0
segments=[{'id':s.get('id'),'start':round(s.get('start'),3),'end':round(s.get('end'),3),'text':s.get('text','').strip(),'confidence':round(s.get('confidence'),3)} for s in whisper.get('segments',[])]
report={'type':'transcription','transcript':{'full_text':whisper.get('text','').strip(),'language':lang_d.get('language',''),'model':'$MODEL','segments':segments,'words':words},'audio_metadata':{'duration_seconds':round(dur,3),'sample_rate':int(astream.get('sample_rate',0)),'channels':int(astream.get('channels',1)),'codec':astream.get('codec_name',''),'format_name':fmt.get('format',{}).get('format_name',''),'size_bytes':int(fmt.get('format',{}).get('size',0))},'speech_analysis':{'total_words':len(words),'total_speech_seconds':round(tspeech,3),'total_silence_seconds':round(silence['total_silence_seconds'],3),'speech_to_silence_ratio':round(tspeech/silence['total_silence_seconds'],2) if silence['total_silence_seconds']>0 else None,'speaking_rate_wpm':round(wpm,1),'average_word_confidence':round(sum(w.get('confidence',1) for w in words)/len(words),3) if words else 0,'silence_gaps':silence['silence_gaps']}}
json.dump(report,open('/tmp/final_transcript.json','w'),ensure_ascii=False,indent=2)
print(f'Done: {len(words)} words, {round(dur,1)}s')"
      - name: Upload to R2
        run: |
          npm init -y && npm install @aws-sdk/client-s3
          node -e "
          const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3'),fs=require('fs');
          async function u(){
            const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY,secretAccessKey:process.env.R2_SECRET_KEY},forcePathStyle:true});
            const f=JSON.parse(process.env.OUTPUT_FILES_JSON||'{}'),d=fs.readFileSync('/tmp/final_transcript.json','utf-8');
            for(const[k,fn]of Object.entries(f)){await s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:fn,Body:d,ContentType:'application/json'}));console.log('RESULT_URL_'+k+'='+process.env.R2_PUBLIC_URL.replace(/\/\$/,'')+'/'+fn);}
          }
          u().catch(e=>{console.error(e);process.exit(1)});"
        env:
          R2_ACCESS_KEY: \${{ secrets.R2_ACCESS_KEY }}
          R2_SECRET_KEY: \${{ secrets.R2_SECRET_KEY }}
          R2_BUCKET: \${{ secrets.R2_BUCKET }}
          R2_ENDPOINT: \${{ secrets.R2_ENDPOINT }}
          R2_PUBLIC_URL: \${{ secrets.R2_PUBLIC_URL }}
          OUTPUT_FILES_JSON: \${{ github.event.inputs.output_files_json }}
TREOF

    echo "  ✅ تم إنشاء transcribe workflow"

    # إنشاء workflow للـ audio probe
    echo "  ⏳ إنشاء audio probe workflow..."

    cat > .github/workflows/audio-probe.yml << 'APEOF'
name: Audio Probe
on:
  workflow_dispatch:
    inputs:
      audio_url: {required: false, type: string, default: ''}
      audio_base64: {required: false, type: string, default: ''}
      output_files_json: {required: true, type: string}
      command_id: {required: true, type: string}
jobs:
  probe:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v3
      - name: Install deps
        run: sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg curl unzip python3
      - name: Download audio
        run: |
          mkdir -p /tmp/audio_in && AURL="${{ github.event.inputs.audio_url }}" && AB64="${{ github.event.inputs.audio_base64 }}"
          if [ -n "$AURL" ]; then curl -L --retry 3 --max-time 120 -o /tmp/audio_in/input_audio "$AURL"
          elif [ -n "$AB64" ]; then echo "$AB64" | base64 -d > /tmp/audio_in/input_audio; else echo "❌ No audio"; exit 1; fi
      - name: Convert to 16kHz WAV
        run: ffmpeg -y -i /tmp/audio_in/input_audio -ar 16000 -ac 1 /tmp/audio_in/converted.wav 2>/dev/null || true
      - name: Extract metadata
        run: ffprobe -v quiet -show_format -show_streams -print_format json /tmp/audio_in/converted.wav > /tmp/audio_metadata.json
      - name: Silence + loudness analysis
        run: |
          ffmpeg -i /tmp/audio_in/converted.wav -af silencedetect=noise=-30dB:d=0.3 -f null - 2>&1 | tee /tmp/silence_raw.txt
          ffmpeg -i /tmp/audio_in/converted.wav -af ebur128=framelog=verbose -f null - 2>&1 | tee /tmp/loudness_raw.txt || true
          python3 -c "
import json,re
with open('/tmp/silence_raw.txt') as f: t=f.read()
ss=re.findall(r'silence_start:\s*([\d.]+)',t); sd=re.findall(r'silence_duration:\s*([\d.]+)',t)
g=[{'start':round(float(ss[i]),3),'end':round(float(ss[i])+float(sd[i]),3) if i<len(sd) else round(float(ss[i])+0.3,3),'duration':round(float(sd[i]),3) if i<len(sd) else 0.3} for i in range(len(ss))]
with open('/tmp/loudness_raw.txt') as f: lt=f.read()
integrated=re.search(r'Integrated loudness:\s*([\-\d.]+)\s*LUFS',lt); peak=re.search(r'Peak:\s*([\-\d.]+)\s*dBFS',lt)
fmt=json.load(open('/tmp/audio_metadata.json'))
astream=next((s for s in fmt.get('streams',[]) if s.get('codec_type')=='audio'),{})
dur=float(fmt.get('format',{}).get('duration',astream.get('duration',0)))
tsil=round(sum(x['duration'] for x in g),3); tsp=round(dur-tsil,3)
sr=round(tsp/tsil,2) if tsil>0 else None
wpm=round(150*(1.0 if sr is None else (0.6 if sr<1 else 0.8 if sr<2 else 1.0 if sr<4 else 1.3)))
report={'type':'audio_probe','audio_metadata':{'duration_seconds':round(dur,3),'sample_rate':int(astream.get('sample_rate',0)),'channels':int(astream.get('channels',1)),'codec':astream.get('codec_name',''),'format_name':fmt.get('format',{}).get('format_name',''),'size_bytes':int(fmt.get('format',{}).get('size',0))},'speech_analysis':{'total_speech_seconds':tsp,'total_silence_seconds':tsil,'speech_density_percent':round(tsp/dur*100,1) if dur>0 else 0,'speech_to_silence_ratio':sr,'estimated_speaking_rate_wpm':wpm,'silence_gaps':g,'silence_count':len(g),'silence_density':round(len(g)/dur*60,1) if dur>0 else 0},'loudness':{'integrated_lufs':round(float(integrated.group(1)),1) if integrated else None,'peak_dbfs':round(float(peak.group(1)),1) if peak else None} if integrated else None}
json.dump(report,open('/tmp/final_probe.json','w'),ensure_ascii=False,indent=2)
print(f'Done: {round(dur,1)}s, {len(g)} gaps, {wpm} WPM')"
      - name: Upload to R2
        run: |
          npm init -y && npm install @aws-sdk/client-s3
          node -e "
          const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3'),fs=require('fs');
          async function u(){
            const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY,secretAccessKey:process.env.R2_SECRET_KEY},forcePathStyle:true});
            const f=JSON.parse(process.env.OUTPUT_FILES_JSON||'{}'),d=fs.readFileSync('/tmp/final_probe.json','utf-8');
            for(const[k,fn]of Object.entries(f)){await s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:fn,Body:d,ContentType:'application/json'}));console.log('RESULT_URL_'+k+'='+process.env.R2_PUBLIC_URL.replace(/\/\$/,'')+'/'+fn);}
          }
          u().catch(e=>{console.error(e);process.exit(1)});"
        env:
          R2_ACCESS_KEY: \${{ secrets.R2_ACCESS_KEY }}
          R2_SECRET_KEY: \${{ secrets.R2_SECRET_KEY }}
          R2_BUCKET: \${{ secrets.R2_BUCKET }}
          R2_ENDPOINT: \${{ secrets.R2_ENDPOINT }}
          R2_PUBLIC_URL: \${{ secrets.R2_PUBLIC_URL }}
          OUTPUT_FILES_JSON: \${{ github.event.inputs.output_files_json }}
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
