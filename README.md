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
| **Webhooks** | ✅ | ❌ |
| **دعم فني** | ✅ | مجتمع GitHub |

---

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
