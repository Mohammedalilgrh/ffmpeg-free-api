# 🎬 FFmpeg API - بديل Rendi.dev مجاني 100%

[![Free](https://img.shields.io/badge/Cost-$0-success)](https://github.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-18,000_min/month-blue)](https://github.com/features/actions)
[![Cloudflare R2](https://img.shields.io/badge/Storage-10GB_Free-orange)](https://www.cloudflare.com/r2/)
[![Node.js](https://img.shields.io/badge/Node-18+-green)](https://nodejs.org)

نظام متكامل لمعالجة الفيديو باستخدام FFmpeg عبر GitHub Actions مجاناً، مع واجهة API مطابقة تماماً لـ Rendi.dev.
تخزين مجاني 10 جيجابايت للفيديوهات
- **Render/Railway**: استضافة مجانية للسيرفر API

# 🎬 FFmpeg API - بديل Rendi.dev مجاني 100%

[![Free](https://img.shields.io/badge/Cost-$0-success)](https://github.com)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-18,000_min/month-blue)](https://github.com/features/actions)
[![Cloudflare R2](https://img.shields.io/badge/Storage-10GB_Free-orange)](https://www.cloudflare.com/r2/)
[![Node.js](https://img.shields.io/badge/Node-18+-green)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

> 🇮🇶 **بديل عراقي 100% لـ Rendi.dev** - اصنع فيديوهات غير محدودة مجاناً باستخدام GitHub Actions + Cloudflare R2

---

## 📑 جدول المحتويات

- [نظرة عامة](#-نظرة-عامة)
- [كيف يعمل؟](#-كيف-يعمل)
- [المميزات](#-المميزات)
- [المتطلبات](#-المتطلبات)
- [الإعداد السريع](#-الإعداد-السريع)
- [النشر على Render](#-النشر-على-render)
- [النشر على Fly.io](#-النشر-على-flyio)
- [التشغيل المحلي](#-التشغيل-المحلي)
- [الربط مع n8n](#-الربط-مع-n8n)
- [API Endpoints](#-api-endpoints)
- [أمثلة عملية](#-أمثلة-عملية)
- [استكشاف الأخطاء](#-استكشاف-الأخطاء)
- [التكلفة](#-التكلفة)
- [مقارنة مع Rendi.dev](#-مقارنة-مع-rendidev)
- [الأسئلة الشائعة](#-الأسئلة-الشائعة)

---

## 📖 نظرة عامة

هذا المشروع هو **بديل مجاني 100%** لخدمة [Rendi.dev](https://rendi.dev) المدفوعة لمعالجة الفيديو باستخدام FFmpeg.

### 🎯 المشكلة
خدمة Rendi.dev تكلف **$19 - $99 شهرياً** لمعالجة الفيديوهات عبر API.

### 💡 الحل
نظام متكامل يستخدم:
- **GitHub Actions** للمعالجة (18,000 دقيقة مجانية شهرياً)
- **Cloudflare R2** للتخزين (10 جيجابايت مجانية)
- **Render** لاستضافة السيرفر (مجاني)

### 💰 النتيجة
**$0 شهرياً للأبد!** مع نفس واجهة Rendi.dev API بالضبط.

---

## 🔄 كيف يعمل؟

```
┌─────────┐      ┌─────────────────┐      ┌──────────────────────┐
│         │      │                 │      │  GitHub Actions      │
│   n8n   │─────►│  API Server     │─────►│  ┌────────────────┐  │
│         │      │  (Render/Fly)   │      │  │ ffmpeg-api     │  │
│         │      │                 │      │  │ ffmpeg-api-2   │  │
│         │      │  - يستقبل الطلب │      │  │ ffmpeg-api-3   │  │
│         │      │  - يوزع العمل   │      │  │ ffmpeg-api-4   │  │
│         │      │  - يتابع الحالة │      │  │ ffmpeg-api-5   │  │
│         │◄─────┤                 │◄─────┤  │ ffmpeg-api-6   │  │
│         │      │                 │      │  └────────────────┘  │
└─────────┘      └─────────────────┘      └──────────┬───────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  Cloudflare R2  │
                                            │  (تخزين الفيديو) │
                                            └─────────────────┘
```

### تدفق العمل خطوة بخطوة:

1. **n8n يرسل طلب** → `POST /v1/run-ffmpeg-command`
2. **السيرفر يختار عامل** → Round-robin بين 6 مستودعات
3. **السيرفر يشغل GitHub Actions** → `workflow_dispatch`
4. **GitHub Actions يعالج:**
   - يحمّل FFmpeg
   - ينزل الملفات من الروابط
   - ينفذ أمر FFmpeg
   - يرفع النتيجة لـ R2
   - يطبع الرابط في السجلات
5. **السيرفر يقرأ السجلات** → يستخرج رابط الفيديو
6. **السيرفر يرجع لـ n8n** → `{ status: "SUCCESS", output_files: {...} }`

---

## ✨ المميزات

### 🎯 مطابقة كاملة لـ Rendi.dev
- ✅ نفس الـ Endpoints بالضبط
- ✅ نفس الـ JSON Structure
- ✅ نفس الـ Status Codes
- ✅ نظام `{{in_1}}` و `{{out_1}}` للمتغيرات
- ✅ دعم الأوامر المتسلسلة (Chained Commands)
- ✅ دعم المجلدات المضغوطة
- ✅ دعم metadata
- ✅ دعم vcpu_count و max_command_run_seconds

### 🚀 أداء وقوة
- ⚡ 6 عمال متوازيين للعمل
- ⚡ 18,000 دقيقة معالجة شهرياً
- ⚡ توزيع تلقائي للحمل (Round-Robin)
- ⚡ معالجة متزامنة (حتى 6 فيديوهات في نفس الوقت)
- ⚡ استخدام كل أنوية المعالج في GitHub Actions

### 💪 استقرار وأمان
- 🛡️ استرداد تلقائي من الأعطال
- 🛡️ حفظ المهام تلقائياً كل 30 ثانية في ملف JSON
- 🛡️ حماية بالمفتاح السري API_KEY (اختياري)
- 🛡️ تحديد المعدل (Rate Limiting) - أقصى 30 مهمة متزامنة
- 🛡️ تنظيف تلقائي للمهام القديمة كل ساعة

### 💰 مجاني للأبد
- 🆓 GitHub Actions: 6 × 3000 = 18,000 دقيقة شهرياً
- 🆓 Cloudflare R2: 10 جيجابايت تخزين مجاناً
- 🆓 Render: استضافة السيرفر مجاناً
- 🆓 UptimeRobot: منع نوم السيرفر مجاناً

---

## 📋 المتطلبات

### الأساسيات
| البرنامج | الإصدار | للتحميل |
|----------|---------|---------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Git** | أي إصدار | [git-scm.com](https://git-scm.com) |
| **GitHub CLI** | اختياري | [cli.github.com](https://cli.github.com) |

### حسابات الخدمات المطلوبة

#### 1. GitHub Token
- روح لـ [GitHub Settings > Tokens](https://github.com/settings/tokens/new)
- اختر **Tokens (classic)**
- الصلاحيات المطلوبة:
  - ✅ `repo` (كل المربعات)
  - ✅ `workflow`
- انسخ الـ token واحفظه بمكان آمن

#### 2. Cloudflare R2
- سجل في [Cloudflare](https://dash.cloudflare.com/sign-up)
- روح لـ R2 > Create Bucket
- اسم الدلو: أي اسم (مثلاً `my-videos`)
- روح لـ R2 > Manage R2 API Tokens
- أنشئ token مع صلاحية **Object Read & Write**
- احفظ:
  - Access Key ID
  - Secret Access Key
  - Endpoint (مثل `https://xxx.r2.cloudflarestorage.com`)
- فعل Public Access للدلو:
  - Settings > Public Access > Allow Access
  - انسخ Public URL (مثل `https://pub-xxx.r2.dev`)

#### 3. Render.com
- سجل في [Render](https://render.com)
- اختر الخطة **Free (Hobby)**

---

## ⚡ الإعداد السريع (3 خطوات)

### الخطوة 1️⃣: تشغيل سكريبت الإعداد

```bash
# استنساخ المشروع
git clone https://github.com/YOUR_USER/ffmpeg-free-api
cd ffmpeg-free-api

# تثبيت المكتبات
npm install

# إعطاء صلاحية التنفيذ
chmod +x setup.sh

# تشغيل سكريبت الإعداد
./setup.sh
```

**الأسئلة اللي راح تنسأل والإجابات:**

| السؤال | مثال للجواب | وين تلقاه؟ |
|--------|------------|------------|
| **GitHub Username** | `ahmed95` | اسم حسابك في GitHub |
| **GitHub Token** | `ghp_1A2B3C4D5E6F...` | من GitHub Settings > Tokens |
| **R2 Access Key ID** | `abc123def456...` | من Cloudflare R2 API Tokens |
| **R2 Secret Access Key** | `xyz789abc123...` | من Cloudflare R2 API Tokens |
| **R2 Bucket Name** | `my-videos` | اسم الدلو في R2 |
| **R2 Endpoint** | `https://xxx.r2.cloudflarestorage.com` | من Cloudflare R2 |
| **R2 Public URL** | `https://pub-xxx.r2.dev` | من Cloudflare R2 Settings |

**ماذا سيحدث تلقائياً:**
- ✅ إنشاء 6 مستودعات GitHub: `ffmpeg-api` حتى `ffmpeg-api-6`
- ✅ رفع workflow جاهز لكل مستودع
- ✅ إعداد 5 أسرار (Secrets) في كل مستودع
- ✅ طباعة ملخص بكل المعلومات

### الخطوة 2️⃣: نشر السيرفر

#### الخيار A: Render (الأسهل)

1. روح لـ [Render Dashboard](https://dashboard.render.com)
2. اضغط **New +** → **Web Service**
3. اختر مستودع `ffmpeg-free-api` من GitHub
4. املأ الإعدادات:

```
Name:            ffmpeg-api
Region:          Frankfurt
Branch:          main
Runtime:         Node
Build Command:   npm install
Start Command:   node api-server.js
Instance Type:   Free
```

5. أضف متغيرات البيئة:

| المفتاح | القيمة |
|---------|--------|
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxx` |
| `GITHUB_USERNAME` | `اسمك_في_github` |
| `R2_PUBLIC_URL` | `https://pub-xxx.r2.dev` |

6. اضغط **Create Web Service**
7. انتظر دقيقة حتى يكتمل النشر
8. انسخ الرابط (مثل `https://ffmpeg-api.onrender.com`)

#### منع النوم على Render:

1. سجل في [UptimeRobot](https://uptimerobot.com)
2. اضغط **+ Create New Monitor**
3. املأ:
   ```
   Monitor Type:    HTTP(s)
   Friendly Name:   FFmpeg API
   URL:             https://ffmpeg-api.onrender.com/health
   Monitoring Interval: 14 minutes
   ```
4. اضغط Create

#### الخيار B: Fly.io (الأفضل - بدون نوم)

```bash
# تحميل flyctl
curl -L https://fly.io/install.sh | sh

# تسجيل الدخول
fly auth login

# إنشاء التطبيق
fly launch --name ffmpeg-api

# إضافة الأسرار
fly secrets set GITHUB_TOKEN=ghp_xxx
fly secrets set GITHUB_USERNAME=yourname
fly secrets set R2_PUBLIC_URL=https://pub-xxx.r2.dev

# النشر
fly deploy
```

#### الخيار C: تشغيل محلي (للتجربة)

```bash
# تشغيل السيرفر محلياً
GITHUB_TOKEN=ghp_xxx GITHUB_USERNAME=yourname R2_PUBLIC_URL=https://pub-xxx.r2.dev node api-server.js

# في نافذة ثانية - فتح نفق للإنترنت
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
./cloudflared tunnel --url http://localhost:3000
```

### الخطوة 3️⃣: ربط n8n

في n8n workflow حقك، غير **فقط** الرابط الأساسي:

```
❌ القديم: https://api.rendi.dev
✅ الجديد: https://ffmpeg-api.onrender.com
```

**كل شيء آخر يبقى كما هو تماماً!**
- نفس الـ endpoints
- نفس الـ JSON structure
- نفس الـ placeholders `{{in_1}}` و `{{out_1}}`
- نفس الـ webhooks

---

## 🔌 API Endpoints

### POST `/v1/run-ffmpeg-command`

تشغيل أمر FFmpeg واحد.

#### الطلب (Request):

```json
{
  "ffmpeg_command": "-i {{in_1}} -vf \"drawtext=text='Hello World':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-th-20\" -c:v libx264 -preset fast -crf 23 {{out_1}} -y",
  "input_files": {
    "in_1": "https://example.com/video.mp4"
  },
  "output_files": {
    "out_1": "my-video.mp4"
  },
  "max_command_run_seconds": 300,
  "vcpu_count": 8,
  "metadata": {
    "workflow": "daily-video"
  }
}
```

#### الرد (Response):

```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### POST `/v1/run-chained-ffmpeg-commands`

تشغيل أوامر متسلسلة (حتى 10 أوامر).

#### الطلب (Request):

```json
{
  "input_files": {
    "in_1": "https://example.com/video.mp4"
  },
  "output_files": {
    "out_1": "scaled.mp4",
    "out_2": "thumbnail.jpg"
  },
  "ffmpeg_commands": [
    "-i {{in_1}} -vf scale=640:480 -c:v libx264 {{out_1}} -y",
    "-i {{out_1}} -ss 00:05 -vframes 1 {{out_2}} -y"
  ],
  "max_command_run_seconds": 600,
  "vcpu_count": 8
}
```

#### الرد (Response):

```json
{
  "command_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

---

### GET `/v1/commands/:command_id`

فحص حالة الأمر والحصول على النتائج.

#### الرد - قيد المعالجة:

```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PROCESSING",
  "command_type": "FFMPEG_COMMAND",
  "original_request": {
    "ffmpeg_command": "-i {{in_1}} ...",
    "input_files": {
      "in_1": "https://example.com/video.mp4"
    },
    "output_files": {
      "out_1": "my-video.mp4"
    }
  }
}
```

#### الرد - مكتمل بنجاح:

```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUCCESS",
  "command_type": "FFMPEG_COMMAND",
  "total_processing_seconds": 45.5,
  "output_files": {
    "out_1": {
      "storage_url": "https://pub-xxx.r2.dev/my-video.mp4",
      "url": "https://pub-xxx.r2.dev/my-video.mp4",
      "file_id": "987fcdeb-a89b-43d3-b456-789012345678",
      "status": "STORED",
      "file_type": "video",
      "mime_type": "video/mp4"
    }
  },
  "original_request": {
    "ffmpeg_command": "-i {{in_1}} ...",
    "input_files": {
      "in_1": "https://example.com/video.mp4"
    },
    "output_files": {
      "out_1": "my-video.mp4"
    }
  },
  "metadata": {
    "workflow": "daily-video"
  },
  "vcpu_count": 8
}
```

#### الرد - فشل:

```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "FAILED",
  "command_type": "FFMPEG_COMMAND",
  "error_status": "PROCESSING_ERROR",
  "error_message": "فشل تنفيذ أمر FFmpeg",
  "original_request": {
    "ffmpeg_command": "-i {{in_1}} ..."
  }
}
```

---

### GET `/health`

فحص صحة السيرفر.

```json
{
  "ok": true,
  "active_jobs": 3,
  "total_jobs": 15
}
```

---

### GET `/`

معلومات عامة عن السيرفر.

```json
{
  "service": "FFmpeg API - بديل Rendi.dev مجاني",
  "version": "1.0.0",
  "endpoints": [
    "/v1/run-ffmpeg-command",
    "/v1/run-chained-ffmpeg-commands",
    "/v1/commands/:id",
    "/health"
  ]
}
```

---

## 📝 أمثلة عملية

### مثال 1: إضافة نص على فيديو

```bash
curl -X POST https://ffmpeg-api.onrender.com/v1/run-ffmpeg-command \
  -H "Content-Type: application/json" \
  -d '{
    "ffmpeg_command": "-i {{in_1}} -vf \"drawtext=text=\"اشترك في القناة\":fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-th-20\" {{out_1}} -y",
    "input_files": {
      "in_1": "https://example.com/video.mp4"
    },
    "output_files": {
      "out_1": "video_with_text.mp4"
    }
  }'
```

### مثال 2: دمج فيديو مع صوت

```bash
curl -X POST https://ffmpeg-api.onrender.com/v1/run-ffmpeg-command \
  -H "Content-Type: application/json" \
  -d '{
    "ffmpeg_command": "-i {{in_1}} -i {{in_2}} -c:v copy -c:a aac -shortest {{out_1}} -y",
    "input_files": {
      "in_1": "https://example.com/video.mp4",
      "in_2": "https://example.com/audio.mp3"
    },
    "output_files": {
      "out_1": "video_with_audio.mp4"
    }
  }'
```

### مثال 3: تغيير حجم الفيديو

```bash
curl -X POST https://ffmpeg-api.onrender.com/v1/run-ffmpeg-command \
  -H "Content-Type: application/json" \
  -d '{
    "ffmpeg_command": "-i {{in_1}} -vf scale=1280:720 -c:v libx264 -preset fast {{out_1}} -y",
    "input_files": {
      "in_1": "https://example.com/video.mp4"
    },
    "output_files": {
      "out_1": "video_720p.mp4"
    }
  }'
```

### مثال 4: أوامر متسلسلة

```bash
curl -X POST https://ffmpeg-api.onrender.com/v1/run-chained-ffmpeg-commands \
  -H "Content-Type: application/json" \
  -d '{
    "input_files": {
      "in_1": "https://example.com/video.mp4"
    },
    "output_files": {
      "out_1": "scaled.mp4",
      "out_2": "thumbnail.jpg"
    },
    "ffmpeg_commands": [
      "-i {{in_1}} -vf scale=640:480 {{out_1}} -y",
      "-i {{out_1}} -ss 00:05 -vframes 1 {{out_2}} -y"
    ]
  }'
```

### مثال 5: فحص الحالة

```bash
# استبدل command_id بالـ ID اللي استلمته
curl https://ffmpeg-api.onrender.com/v1/commands/550e8400-e29b-41d4-a716-446655440000
```

---

## 🔧 استكشاف الأخطاء

### ❌ المشكلة: السيرفر ينام على Render

**السبب:** Render يوقف السيرفر بعد 15 دقيقة بدون استخدام.

**الحل:**
1. سجل في [UptimeRobot](https://uptimerobot.com)
2. أضف Monitor لـ `https://your-app.onrender.com/health`
3. اختار الفحص كل 14 دقيقة
4. ✅ السيرفر يبقى صاحي 24/7

---

### ❌ المشكلة: GitHub Actions فشل

**الأسباب المحتملة:**
1. رابط الملف غير قابل للوصول (تأكد إنه Public)
2. أمر FFmpeg فيه خطأ (جرب الأمر محلياً أول)
3. حجم الملف كبير جداً (> 500 ميجابايت)

**الحل:**
1. روح للمستودع العامل (مثلاً `ffmpeg-api-3`)
2. اضغط على Actions
3. افتح الـ run الفاشل
4. اقرأ السجلات لمعرفة الخطأ

---

### ❌ المشكلة: "الباندويث خلص" على Render

**هذا مستحيل!** لأن السيرفر فقط يمرر JSON صغير:
- كل طلب = 2-5 كيلوبايت
- 5 جيجابايت = 5,000,000 كيلوبايت
- يعني **مليون طلب** شهرياً قبل ما يخلص الباندويث!

---

### ❌ المشكلة: الأسرار غير موجودة في المستودعات

**الحل:** أضف الأسرار يدوياً في كل مستودع:
1. روح لأي مستودع (مثلاً `ffmpeg-api-2`)
2. Settings → Secrets and variables → Actions
3. أضف هذه الأسرار:

| اسم السر | القيمة |
|----------|--------|
| `R2_ACCESS_KEY` | Access Key ID حق R2 |
| `R2_SECRET_KEY` | Secret Key حق R2 |
| `R2_BUCKET` | اسم الدلو |
| `R2_ENDPOINT` | `https://xxx.r2.cloudflarestorage.com` |
| `R2_PUBLIC_URL` | `https://pub-xxx.r2.dev` |

---

### ❌ المشكلة: المتغيرات `{{in_1}}` ما تشتغل

**تأكد من:**
1. استخدام `{{in_1}}` وليس `{in_1}` أو `{{IN_1}}`
2. اسم المفتاح في `input_files` يبدأ بـ `in_`
3. اسم المفتاح في `output_files` يبدأ بـ `out_`

---

### ❌ المشكلة: رابط الفيديو الناتج ما يشتغل

**الأسباب:**
1. Cloudflare R2 غير مفعل Public Access
2. اسم الملف مختلف

**الحل:**
1. روح لـ Cloudflare R2
2. اختار الدلو
3. Settings → Public Access → Allow
4. تأكد إن Public URL صحيح

---

## 📊 التكلفة

### 💰 التكلفة الشهرية: $0

| الخدمة | الاستخدام الشهري | السعر |
|--------|-----------------|-------|
| **GitHub Actions** | 18,000 دقيقة | $0 |
| **Cloudflare R2** | 10 جيجابايت | $0 |
| **Render** | 750 ساعة | $0 |
| **UptimeRobot** | مراقبة | $0 |
| **المجموع** | | **$0.00** |

### 📈 كم فيديو تقدر تسوي؟

| حجم الفيديو | وقت المعالجة التقريبي | عدد الفيديوهات شهرياً |
|-------------|---------------------|---------------------|
| 10 ثواني | 30 ثانية | **36,000 فيديو** |
| 30 ثانية | 1 دقيقة | **18,000 فيديو** |
| دقيقة واحدة | 2 دقيقة | **9,000 فيديو** |
| 5 دقائق | 5 دقائق | **3,600 فيديو** |

---

## 🆚 مقارنة مع Rendi.dev

| الميزة | Rendi.dev | هذا المشروع |
|--------|-----------|-------------|
| **السعر الشهري** | $19 - $99 | **$0 للأبد** |
| **API مطابق** | ✅ | ✅ |
| **الأوامر المتسلسلة** | ✅ | ✅ |
| **نظام المتغيرات `{{}}`** | ✅ | ✅ |
| **المعالجة** | سيرفرات سحابية | GitHub Actions |
| **التخزين** | 50+ جيجابايت | 10 جيجابايت |
| **الدقائق الشهرية** | حسب الخطة | 18,000 دقيقة |
| **عدد العمال** | غير محدد | 6 عمال |
| **API Key** | ✅ إجباري | ✅ اختياري |
| **Rate Limiting** | ✅ | ✅ |
| **Transcribe (STT)** | ❌ | ✅ **جديد** |
| **Webhooks** | ✅ | ❌ |
| **دعم فني** | ✅ | مجتمع GitHub |

---

## 🎤 Transcription & Audio Analysis API (جديد!)

> **حوّل أي صوت إلى نص مكتوب مع تحليلات كاملة** — كلمات مع توقيت، فترات الصمت، سرعة الكلام، وغيرها.
> مثالية لربط الصوت مع السكريبتات والمشاهد في n8n بدقة 100%.

### POST `/v1/transcribe`

يحول ملف صوتي إلى نص مكتوب مع تحليلات كاملة.

#### طريقة الاستخدام

**الخيار 1: رابط صوتي عام (Public URL)**
```json
{
  "audio_url": "https://example.com/my-audio.mp3",
  "language": "ar",
  "model_size": "base",
  "word_timestamps": true
}
```

**الخيار 2: ملف صوتي بصيغة Base64**
```json
{
  "audio_base64": "//uQxAAAAAANIAAAAAE...",
  "language": "en",
  "model_size": "base"
}
```

#### المعاملات (Parameters)

| الحقل | النوع | إجباري | الافتراضي | الشرح |
|-------|-------|--------|-----------|-------|
| `audio_url` | string | لا* | - | رابط عام للملف الصوتي (MP3, WAV, M4A, OGG...) |
| `audio_base64` | string | لا* | - | الملف الصوتي بصيغة Base64 |
| `language` | string | لا | `auto` | لغة الصوت (`ar`, `en`, `fr`, `auto` للكشف التلقائي) |
| `model_size` | string | لا | `base` | دقة النموذج (`tiny` سريع, `base` وسط, `small`, `medium`, `large` دقيق) |
| `word_timestamps` | bool | لا | `true` | هل تريد توقيت كل كلمة على حدة |
| `command_id` | string | لا | تلقائي | ID مخصص للمتابعة (اختياري) |

> *يجب توفير إما `audio_url` أو `audio_base64`

#### الرد (Response)

```json
{
  "command_id": "transcribe_a1b2c3d4e5f6",
  "status": "PROCESSING",
  "type": "TRANSCRIBE",
  "worker": "ffmpeg-api-3",
  "message": "Use GET /v1/commands/transcribe_a1b2c3d4e5f6 to get results when ready"
}
```

### الحصول على النتيجة

استخدم نفس endpoint الموجود:

```
GET /v1/commands/transcribe_a1b2c3d4e5f6
```

#### الرد عند اكتمال التحليل:

```json
{
  "command_id": "transcribe_a1b2c3d4e5f6",
  "status": "SUCCESS",
  "command_type": "TRANSCRIBE",
  "total_processing_seconds": 47.3,
  "transcript": {
    "full_text": "مرحباً بكم في هذا الفيديو التعليمي...",
    "language": "ar",
    "model": "base",
    "segments": [
      {
        "id": 0,
        "start": 0.0,
        "end": 3.5,
        "text": "مرحباً بكم في هذا الفيديو التعليمي",
        "confidence": 0.98
      }
    ],
    "words": [
      {
        "word": "مرحباً",
        "start": 0.0,
        "end": 0.6,
        "confidence": 0.99,
        "index": 0
      },
      {
        "word": "بكم",
        "start": 0.6,
        "end": 1.0,
        "confidence": 0.97,
        "index": 1
      }
    ]
  },
  "audio_metadata": {
    "duration_seconds": 30.5,
    "sample_rate": 16000,
    "channels": 1,
    "codec": "pcm_s16le",
    "format_name": "wav",
    "size_bytes": 488000
  },
  "speech_analysis": {
    "total_words": 85,
    "total_speech_seconds": 22.3,
    "total_silence_seconds": 8.2,
    "speech_to_silence_ratio": 2.72,
    "speaking_rate_wpm": 150.2,
    "average_word_confidence": 0.95,
    "silence_gaps": [
      {
        "start": 3.5,
        "end": 4.2,
        "duration": 0.7
      }
    ]
  },
  "output_files": {
    "out_transcript": {
      "url": "https://pub-xxx.r2.dev/transcript_transcribe_a1b2c3d4e5f6.json"
    }
  }
}
```

#### ما راح ترجعلك (Data you get):

| المعلومة | الوصف | كيف تفيدك في n8n |
|----------|-------|------------------|
| **`transcript.full_text`** | النص الكامل | تستخدمه كـ subtitle أو Caption |
| **`transcript.words[].start/end`** | توقيت كل كلمة بالثانية | تحدد وقت ظهور كل كلمة في الفيديو بدقة |
| **`transcript.segments`** | فقرات النص مع توقيتها | تقسم الفيديو إلى مشاهد حسب الكلام |
| **`speech_analysis.silence_gaps`** | أوقات الصمت بين الكلام | تعرف وين تدرس transitions أو breaks |
| **`speech_analysis.speaking_rate_wpm`** | سرعة الكلام (كلمة/دقيقة) | تضبط مدة العرض حسب سرعة المتحدث |
| **`audio_metadata.duration_seconds`** | المدة الكلية للصوت | تعرف كم طول المقطع الصوتي |

### أمثلة عملية لـ n8n

#### مثال 1: تحويل صوت إلى نص ومزامنته مع الفيديو

في n8n Workflow:

1. **HTTP Request Node** → POST `/v1/transcribe`
   ```json
   {
     "audio_url": "https://example.com/voiceover.mp3",
     "language": "ar",
     "word_timestamps": true
   }
   ```

2. **Wait Node** → 30 seconds (أو استخدم Loop + GET /v1/commands/:id)

3. **HTTP Request Node** → GET `/v1/commands/{{$json.command_id}}`

4. **استخدم البيانات**:
   ```
   {{$json.transcript.full_text}}          ← النص الكامل
   {{$json.transcript.words}}              ← كل كلمة بتوقيتها
   {{$json.speech_analysis.silence_gaps}}  ← فترات الصمت
   {{$json.speech_analysis.speaking_rate_wpm}} ← سرعة الكلام
   ```

#### مثال 2: مزامنة الصوت مع المشاهد (Scene Sync)

افترض عندك مشاهد فيديو بمدة معينة، تبي تقسم النص حسب المشاهد:

```javascript
// Code Node in n8n
const transcript = $input.first().json.transcript;
const words = transcript.words;
const sceneDuration = 5; // كل مشهد 5 ثواني

const scenes = [];
let currentScene = { text: "", start: words[0]?.start || 0 };

words.forEach(word => {
  if (word.end - currentScene.start > sceneDuration) {
    scenes.push({
      start: currentScene.start,
      end: word.end,
      text: currentScene.text.trim(),
      words: words.filter(w => w.start >= currentScene.start && w.end <= word.end)
    });
    currentScene = { text: "", start: word.end };
  }
  currentScene.text += word.word + " ";
});

return scenes;
```

#### مثال 3: توليد Subtitles (SRT format)

```javascript
// Code Node in n8n - generate SRT from words
const words = $input.first().json.transcript.words;
const wordsPerSub = 7; // كلمات لكل subtitle
let srt = "", counter = 1;

function toSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

for (let i = 0; i < words.length; i += wordsPerSub) {
  const chunk = words.slice(i, i + wordsPerSub);
  srt += `${counter}\n${toSrtTime(chunk[0].start)} --> ${toSrtTime(chunk[chunk.length-1].end)}\n${chunk.map(w=>w.word).join(' ')}\n\n`;
  counter++;
}

return srt;
```

---

### نصائح لاختيار `model_size`

| النموذج | السرعة | الدقة | الاستخدام |
|---------|--------|-------|-----------|
| `tiny` | 🚀 سريع جداً | 😐 متوسط | تجارب سريعة |
| `base` | ⚡ سريع | 😊 جيد | **الافتراضي - recommended** |
| `small` | 🐢 متوسط | 😄 ممتاز | نصوص دقيقة |
| `medium` | 🐌 بطيء | 🤩 دقيق جداً | محتوى رسمي |
| `large` | 🐢🐢 بطيء | 🏆 الأفضل | أدق تفاصيل |

> 💡 النموذج `base` كافٍ 90% من الاستخدامات. استخدم `small` أو `medium` إذا كان audio quality منخفض.

---

### الصيغ المدعومة (Audio Formats)

أي صيغة يدعمها FFmpeg:
- MP3, WAV, M4A, AAC, OGG, FLAC, WMA
- فيديوهات بصوت: MP4, AVI, MOV, MKV
- المدة القصوى: ~20 دقيقة (حسب GitHub Actions timeout)

---

### استكشاف أخطاء Transcription

#### ❌ المدة طويلة > 20 دقيقة
**الحل:** قسم الصوت لأجزاء باستخدام FFmpeg قبل الإرسال.

#### ❌ التعرف على العربية ضعيف
**الحل:** حدد `"language": "ar"` صراحةً واستخدم `model_size: "small"` أو أكبر.

#### ❌ الخطأ: "No audio source"
**تأكد:** أرسلت إما `audio_url` (رابط عام) أو `audio_base64` (النص الكامل المشفر).

#### ❌ الكلمات تنقصها الثقة (confidence منخفض)
**الحل:** جرب `model_size: "medium"` لنتيجة أدق.

---

## 📊 Audio Probe API (تحليل الصوت فقط)

> **لما تحتاج معلومات الصوت بدون ترجمة** — تحليل سريع للمدة، فترات الصمت، الصوت (loudness)، والتقديرات.
> أسرع بكثير من /v1/transcribe لأنه ما يحتاج تحميل نموذج Whisper.

### POST `/v1/audio-probe`

#### الطلب (Request):

```json
{
  "audio_url": "https://example.com/voiceover.mp3"
}
```

أو Base64:
```json
{
  "audio_base64": "//uQxAAAAAANIAAAAAE..."
}
```

#### الرد عند اكتمال التحليل:

```json
{
  "command_id": "probe_a1b2c3d4e5f6",
  "status": "SUCCESS",
  "command_type": "AUDIO_PROBE",
  "probe": {
    "audio_metadata": {
      "duration_seconds": 45.3,
      "sample_rate": 16000,
      "channels": 1,
      "codec": "pcm_s16le",
      "format_name": "wav",
      "size_bytes": 724800
    },
    "speech_analysis": {
      "total_speech_seconds": 32.1,
      "total_silence_seconds": 13.2,
      "speech_density_percent": 70.9,
      "speech_to_silence_ratio": 2.43,
      "estimated_speaking_rate_wpm": 150,
      "estimated_speaking_rate_label": "normal",
      "note": "Speaking rate is estimated from silence density (no transcription). Use POST /v1/transcribe for exact WPM.",
      "silence_gaps": [
        {"start": 0.0, "end": 0.8, "duration": 0.8},
        {"start": 4.2, "end": 5.1, "duration": 0.9}
      ],
      "silence_count": 12,
      "silence_density": 15.9
    },
    "loudness": {
      "integrated_lufs": -16.2,
      "peak_dbfs": -1.5
    }
  }
}
```

### الفرق بين `/v1/transcribe` و `/v1/audio-probe`

| الميزة | `/v1/transcribe` | `/v1/audio-probe` |
|--------|-------------------|-------------------|
| **سرعة** | 🐢 بطيء (يحمّل Whisper ~150MB) | ⚡ سريع جداً (ثواني) |
| **النص المكتوب** | ✅ نعم (كامل) | ❌ لا |
| **توقيت الكلمات** | ✅ كل كلمة بتوقيتها | ❌ فقط تقدير سرعة الكلام |
| **فترات الصمت** | ✅ دقيقة | ✅ دقيقة |
| **Loudness** | ❌ لا | ✅ نعم (EBU R128) |
| **مدة المعالجة** | 1-5 دقائق | 10-30 ثانية |
| **متى تستخدم** | تحتاج النص + التوقيت الدقيق | تحتاج تحليل سريع بدون ترجمة |

---

#### استخدم `/v1/audio-probe` في n8n لما تريد:

1. **معرفة مدة الصوت** قبل المونتاج
2. **تحديد فترات الصمت** لوضع transitions
3. **تقدير سرعة الكلام** لضبط مدة المشاهد
4. **فحص مستوى الصوت** (loudness) قبل النشر
5. **حساب كثافة الكلام** — كم ثانية كلام مقابل صمت

---


#########################################################################
## 🚀 النشر على Render (Web Service المجاني)

Render يعطيك Web Service مجاني لتشغيل السيرفر. راح نشرح كل خطوة بالتفصيل:

---

### 📝 المتطلبات قبل النشر

تأكد من:
- [x] المستودع `ffmpeg-free-api` موجود على GitHub
- [x] الـ 6 مستودعات عمال جاهزة (شغلت `./setup.sh`)
- [x] حساب Render.com مفعل

---

### 🎯 الخطوة 1: ربط GitHub مع Render

1. **روح لـ [Render Dashboard](https://dashboard.render.com)**
2. **اضغط:** `New +` → `Web Service`
3. **صلاحيات GitHub:**
   - اضغط `Connect GitHub`
   - اختر `Only select repositories`
   - اختر `ffmpeg-free-api`
   - اضغط `Install & Authorize`
4. **ابحث عن مستودعك:** اكتب `ffmpeg-free-api` → `Connect`

---

### ⚙️ الخطوة 2: إعدادات الخدمة

املأ هذه البيانات:

```
┌─────────────────────────────────────────┐
│ 📝 Name                                │
│ ffmpeg-api                             │
├─────────────────────────────────────────┤
│ 🌍 Region                              │
│ Frankfurt (Germany) ← الأقرب للعراق    │
├─────────────────────────────────────────┤
│ 🌿 Branch                              │
│ main                                   │
├─────────────────────────────────────────┤
│ 📦 Runtime                             │
│ Node                                   │
├─────────────────────────────────────────┤
│ 🔨 Build Command                       │
│ npm install                            │
├─────────────────────────────────────────┤
│ ▶️ Start Command                       │
│ node api-server.js                     │
├─────────────────────────────────────────┤
│ 💰 Instance Type                       │
│ Free (Hobby)                           │
└─────────────────────────────────────────┘
```

**الخطة المجانية (Hobby):**
| الميزة | الحد |
|--------|------|
| RAM | 512 MB |
| CPU | 0.1 vCPU |
| ساعات شهرياً | 750 ساعة |
| باندويث | 5 GB |
| نوم | بعد 15 دقيقة |

---

### 🔐 الخطوة 3: متغيرات البيئة (إجباري)

تحت `Environment Variables` أضف:

```
┌──────────────────────────────────────────────────┐
│ KEY              │ VALUE                         │
├──────────────────┼───────────────────────────────┤
│ GITHUB_TOKEN     │ ghp_xxxxxxxxxxxxxxxxxxxx      │
│ GITHUB_USERNAME  │ your-username                 │
│ R2_PUBLIC_URL    │ https://pub-xxx.r2.dev        │
│ API_KEY          │ my-secret-key (اختياري)       │
└──────────────────────────────────────────────────┘
```

**وين تلقى هذه القيم؟**

| القيمة | تلقاها من |
|--------|-----------|
| `GITHUB_TOKEN` | GitHub → Settings → Developer settings → Tokens |
| `GITHUB_USERNAME` | اسم المستخدم حقك في GitHub |
| `R2_PUBLIC_URL` | Cloudflare R2 → الدلو → Settings → Public URL |
| `API_KEY` | أي كلمة سر تختارها (للحماية) |

---

### 🎬 الخطوة 4: إنشاء ونشر

1. **اضغط:** `Create Web Service`
2. **انتظر البناء (3-5 دقائق):**

```
⏳ Cloning repository...
⏳ Installing dependencies (npm install)...
⏳ Building...
⏳ Deploying...
✅ Your service is live!
```

3. **السجلات الناجحة راح تظهر:**

```
🚀 السيرفر شغال على المنفذ 3000
👷 العمال: 6
👤 المستخدم: your-username
```

4. **الرابط النهائي:**

```
🟢 https://ffmpeg-api.onrender.com
```

**هذا الرابط هو اللي تستخدمه في n8n!**

---

### ⏰ الخطوة 5: منع نوم السيرفر (ضروري)

السيرفر على Render **ينام بعد 15 دقيقة بدون استخدام**. لمنع هذا:

#### استخدم UptimeRobot (مجاني):

1. **سجل في [UptimeRobot](https://uptimerobot.com)**
2. **اضغط:** `+ Create New Monitor`
3. **املأ البيانات:**

```
┌────────────────────────────────────────┐
│ Monitor Type:    HTTP(s)               │
│ Friendly Name:   FFmpeg API            │
│ URL:             https://ffmpeg-api    │
│                  .onrender.com/health  │
│ Interval:        14 minutes            │
│ Timeout:         30 seconds            │
└────────────────────────────────────────┘
```

4. **اضغط:** `Create Monitor`
5. **تأكد إنه يشتغل:** روح لـ `https://ffmpeg-api.onrender.com/health`

**الرد الصحيح:**
```json
{
  "ok": true,
  "active_jobs": 0,
  "total_jobs": 0
}
```

✅ **الحين السيرفر صاحي 24/7!**

---

### 🧪 الخطوة 6: اختبار السيرفر

#### اختبار الصحة:
```bash
curl https://ffmpeg-api.onrender.com/health
```

#### اختبار أمر FFmpeg:
```bash
curl -X POST https://ffmpeg-api.onrender.com/v1/run-ffmpeg-command \
  -H "Content-Type: application/json" \
  -d '{
    "input_files": {
      "in_1": "https://storage.rendi.dev/sample/sample.avi"
    },
    "output_files": {
      "out_1": "test-output.mp4"
    },
    "ffmpeg_command": "-i {{in_1}} -vf scale=320:240 {{out_1}} -y"
  }'
```

**الرد المتوقع:**
```json
{
  "command_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### فحص النتيجة:
```bash
curl https://ffmpeg-api.onrender.com/v1/commands/550e8400-e29b-41d4-a716-446655440000
```

**بعد دقيقة تقريباً:**
```json
{
  "command_id": "550e8400-...",
  "status": "SUCCESS",
  "output_files": {
    "out_1": {
      "storage_url": "https://pub-xxx.r2.dev/test-output.mp4",
      "url": "https://pub-xxx.r2.dev/test-output.mp4"
    }
  }
}
```

---

### 🔄 الخطوة 7: ربط n8n

في n8n workflow حقك، غير **فقط** Base URL:

```
┌────────────────────────────────────────────┐
│ ❌ القديم: https://api.rendi.dev           │
│ ✅ الجديد: https://ffmpeg-api.onrender.com │
└────────────────────────────────────────────┘
```

**كل شيء آخر يبقى كما هو:**
- نفس الـ body
- نفس الـ headers
- نفس الـ endpoints
- نفس الـ variables

---

### 📊 مراقبة السيرفر

#### في Render Dashboard:
```
https://dashboard.render.com
→ اختار ffmpeg-api
→ تشوف: Logs, Metrics, Usage
```

#### مقاييس مهمة:
| المقياس | الطبيعي | خطر |
|---------|---------|-----|
| **CPU** | 1-5% | > 80% |
| **Memory** | 50-100 MB | > 400 MB |
| **Requests** | 10-100/دقيقة | > 1000/دقيقة |
| **Response Time** | 50-200ms | > 1000ms |

---

### 🔧 حل مشاكل Render الشائعة

#### ❌ السيرفر ينام رغم UptimeRobot
**الحل:**
1. تأكد إن UptimeRobot يفحص `/health`
2. اختار Interval = 14 minutes (مو 30)
3. تأكد إن الرابط صحيح ويبدأ بـ `https://`

#### ❌ Build فشل
**الحل:**
```bash
# تأكد إن package.json موجود ويحتوي:
{
  "dependencies": {
    "express": "^4.18.2",
    "uuid": "^9.0.0"
  }
}
```

#### ❌ السيرفر يشتغل بس ما يستجيب
**الحل:**
1. روح لـ Render Dashboard → Logs
2. تأكد من متغيرات البيئة موجودة
3. تأكد إن `GITHUB_TOKEN` له صلاحيات `repo` و `workflow`

#### ❌ خطأ: "Cannot find module"
**الحل:**
- تأكد إن `Build Command` هو: `npm install`
- روح لـ Manual Deploy → Clear cache and redeploy

---

### 💡 نصائح لـ Render

1. **لا تستخدم المتغيرات الحساسة في الكود** - استخدم Environment Variables
2. **راقب السجلات أول أسبوع** - عشان تتأكد كل شيء تمام
3. **استخدم UptimeRobot** - بدون منع النوم، السيرفر ياخذ 30-60 ثانية عشان يصحى
4. **الخطة المجانية تكفي** - 750 ساعة = شهر كامل + 20 ساعة إضافية
5. **الباندويث ما يخلص** - 5 GB = مليون طلب JSON

---

### 📈 ترقية الخطة (إذا احتجت)

| الخطة | السعر | المميزات |
|-------|-------|----------|
| **Hobby** | $0 | 512 MB, 0.1 CPU, ينام |
| **Starter** | $7/شهر | 1 GB, 0.5 CPU, بدون نوم |
| **Pro** | $25/شهر | 2 GB, 1 CPU, تحليلات |

**ما تحتاج ترقية! Hobby كافية تماماً**

---

### ✅ قائمة التحقق النهائية

- [ ] ربطت GitHub مع Render
- [ ] اخترت مستودع `ffmpeg-free-api`
- [ ] حطيت Build: `npm install`
- [ ] حطيت Start: `node api-server.js`
- [ ] أضفت `GITHUB_TOKEN`
- [ ] أضفت `GITHUB_USERNAME`
- [ ] أضفت `R2_PUBLIC_URL`
- [ ] شغلت UptimeRobot على `/health`
- [ ] اختبرت `/health` ويطلع `ok: true`
- [ ] جربت POST أمر FFmpeg
- [ ] جربت GET النتيجة
- [ ] غيرت الرابط في n8n

**إذا كل المربعات ✅ - خلاص أنت جاهز! 🎉**
#######################################################################################

## ❓ الأسئلة الشائعة

### س: هل هذا قانوني؟
**ج:** نعم! GitHub Actions مسموح استخدامه لأي غرض تشغيل آلي بما فيها معالجة الفيديو.

### س: هل في حدود لحجم الفيديو؟
**ج:** GitHub Actions يسمح بملفات حتى ~500 ميجابايت. للملفات الأكبر، قسمها لأجزاء.

### س: كم فيديو أقدر أسوي في نفس الوقت؟
**ج:** 6 فيديوهات متزامنة (كل عامل يشتغل على فيديو واحد).

### س: هل أحتاج بطاقة ائتمانية؟
**ج:** لا! كل الخدمات مجانية بدون بطاقة:
- GitHub: مجاني للأبد
- Cloudflare R2: مجاني بدون بطاقة
- Render: مجاني بدون بطاقة

### س: هل أقدر أزيد عدد العمال؟
**ج:** نعم! عدل `WORKER_REPOS` في `api-server.js` وأضف مستودعات جديدة.

### س: شنو يصير لو خلصت الـ 18,000 دقيقة؟
**ج:** GitHub يوقف العمال الزائدين. لكن 18,000 دقيقة تكفي لآلاف الفيديوهات!

### س: هل بياناتي آمنة؟
**ج:** الفيديوهات تخزنت في Cloudflare R2 الخاص فيك. السيرفر ما يخزن فيديوهات.

### س: أقدر استخدم Google Drive بدل R2؟
**ج:** أي رابط Public يشتغل كـ `input_files`. للمخرجات، تحتاج تخزين مثل R2 أو S3.

### س: هل السيرفر يتحمل ضغط؟
**ج:** نعم! الـ API Server بس يمرر طلبات JSON. المعالجة الفعلية في GitHub Actions.

### س: شنو الفرق بين الأوامر العادية والمتسلسلة؟
**ج:**
- **عادي:** أمر FFmpeg واحد
- **متسلسل:** عدة أوامر، كل أمر يستخدم مخرجات الأمر اللي قبله

### س: هل يدعم كل صيغ FFmpeg؟
**ج:** نعم! أي أمر FFmpeg يشتغل على Ubuntu راح يشتغل في GitHub Actions.

---

## 🏗️ هيكل المشروع

```
ffmpeg-free-api/
├── .gitignore                    # ملفات التجاهل
├── README.md                     # هذا الملف
├── Dockerfile                    # لبناء Docker image
├── package.json                  # مكتبات Node.js
├── setup.sh                      # سكريبت الإعداد التلقائي
├── api-server.js                 # السيرفر الرئيسي (API)
└── .github/
    └── workflows/
        └── render-video.yml      # Workflow للعمال (ينسخ لـ 6 مستودعات)
```

---

## 🤝 المساهمة

المساهمات مرحب بها! إذا حبيت تضيف ميزة أو تصلح خطأ:

1. اعمل Fork للمشروع
2. اعمل Branch للتعديل: `git checkout -b feature/ميزة-جديدة`
3. عدل وأضف: `git commit -m 'إضافة ميزة جديدة'`
4. ارفع: `git push origin feature/ميزة-جديدة`
5. افتح Pull Request

---

## ⭐ دعم المشروع

إذا أفادك المشروع:
- ⭐ أعطنا نجمة على GitHub
- 📢 شاركه مع أصدقائك
- 🐛 أبلغ عن المشاكل في Issues
- 💡 اقترح ميزات جديدة

---

## 📜 الرخصة

MIT License - استخدمها كيفما تشاء.

---

## 🙏 شكر خاص

- [GitHub Actions](https://github.com/features/actions) - للمعالجة المجانية
- [Cloudflare R2](https://www.cloudflare.com/r2/) - للتخزين المجاني
- [Render](https://render.com) - للاستضافة المجانية
- [Rendi.dev](https://rendi.dev) - للـ API design

---

**صنع بـ ❤️ للمجتمع العربي**

*آخر تحديث: 2024 - كل الحقوق محفوظة للمجتمع*
