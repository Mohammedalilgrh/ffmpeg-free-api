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
    
    # إنشاء workflow
    echo "  ⏳ إنشاء workflow..."
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
    
    # رفع الملفات
    git add .
    git commit -m "Add render workflow" --quiet
    git push origin main --quiet
    cd ..
    rm -rf "temp_${REPO_NAME}"
    
    echo "  ✅ تم رفع workflow"
    
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
echo "║   💰 التكلفة: 0$ للأبد                                       ║"
echo "║   ⚡ 18,000 دقيقة معالجة شهرياً                               ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
