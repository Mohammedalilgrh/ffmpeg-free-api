import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const app = express();
app.use(express.json());

// تكوين المتغيرات
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const API_KEY = process.env.API_KEY;

// العمال الستة
const WORKER_REPOS = [
    'ffmpeg-api',
    'ffmpeg-api-2',
    'ffmpeg-api-3',
    'ffmpeg-api-4',
    'ffmpeg-api-5',
    'ffmpeg-api-6'
];

let currentRepoIndex = 0;
let jobs = new Map();

// تحميل المهام المحفوظة (للتعافي من الأعطال)
function loadJobs() {
    try {
        if (fs.existsSync('jobs-backup.json')) {
            const data = fs.readFileSync('jobs-backup.json', 'utf8');
            const parsed = JSON.parse(data);
            jobs = new Map(parsed);
            console.log(`📂 تم تحميل ${jobs.size} مهمة من النسخة الاحتياطية`);
        }
    } catch (e) {
        console.log('📝 بداية جديدة - لا توجد نسخة احتياطية');
    }
}

// حفظ المهام كل 30 ثانية
function saveJobs() {
    try {
        const data = JSON.stringify(Array.from(jobs.entries()));
        fs.writeFileSync('jobs-backup.json', data);
    } catch (e) {
        console.error('خطأ في حفظ المهام:', e);
    }
}

loadJobs();
setInterval(saveJobs, 30000);

// تنظيف المهام القديمة كل ساعة
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
        if (now - job.created_at > 3600000) {
            jobs.delete(id);
        }
    }
    saveJobs();
}, 3600000);

// middleware للمصادقة (اختياري)
function authMiddleware(req, res, next) {
    if (API_KEY) {
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== API_KEY) {
            return res.status(401).json({ detail: 'Invalid authorization key' });
        }
    }
    next();
}

// اختيار العامل التالي
function getNextRepo() {
    const repo = WORKER_REPOS[currentRepoIndex % WORKER_REPOS.length];
    currentRepoIndex++;
    return repo;
}

// التحقق من صحة المفاتيح
function validateKeys(input_files, output_files) {
    if (input_files) {
        for (const key of Object.keys(input_files)) {
            if (!key.startsWith('in_')) {
                throw new Error(`مفتاح الإدخال "${key}" يجب أن يبدأ بـ "in_"`);
            }
        }
    }
    if (output_files && output_files !== 'OUTPUT_FOLDER') {
        for (const key of Object.keys(output_files)) {
            if (!key.startsWith('out_')) {
                throw new Error(`مفتاح الإخراج "${key}" يجب أن يبدأ بـ "out_"`);
            }
        }
    }
}

// تشغيل workflow في GitHub Actions
async function triggerWorkflow(repo, inputs) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/workflows/render-video.yml/dispatches`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main', inputs })
    });

    if (response.status !== 204) {
        throw new Error(`خطأ GitHub API: ${response.status}`);
    }

    // انتظار إنشاء run
    await new Promise(resolve => setTimeout(resolve, 4000));

    // جلب run ID
    const runsUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs?per_page=1`;
    const runsRes = await fetch(runsUrl, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    const runsData = await runsRes.json();
    
    return runsData.workflow_runs?.[0]?.id || null;
}

// فحص حالة التشغيل
async function checkRunStatus(repo, runId) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}`;
    const response = await fetch(url, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    return await response.json();
}

// جلب السجلات
async function getWorkflowLogs(repo, runId) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}/logs`;
    const response = await fetch(url, {
        headers: { 'Authorization': `token ${GITHUB_TOKEN}` }
    });
    return await response.text();
}

// استخراج روابط المخرجات من السجلات
function extractOutputFiles(logs, outputFiles) {
    const results = {};
    const lines = logs.split('\n');
    
    for (const line of lines) {
        const match = line.match(/VIDEO_URL_RESULT_(\w+)=(.+)/);
        if (match) {
            const key = match[1];
            const url = match[2].trim();
            results[key] = {
                storage_url: url,
                url: url,
                file_id: uuidv4(),
                status: 'STORED',
                file_type: 'video',
                mime_type: 'video/mp4'
            };
        }
    }
    
    // احتياط: إنشاء روابط لكل ملف مخرج
    if (Object.keys(results).length === 0 && outputFiles && typeof outputFiles === 'object') {
        for (const [key, filename] of Object.entries(outputFiles)) {
            const url = `${R2_PUBLIC_URL}/${filename}`;
            results[key] = {
                storage_url: url,
                url: url,
                file_id: uuidv4(),
                status: 'STORED',
                file_type: 'video',
                mime_type: 'video/mp4'
            };
        }
    }
    
    return results;
}

// ============== API ENDPOINTS ==============

// POST /v1/run-ffmpeg-command
app.post('/v1/run-ffmpeg-command', authMiddleware, async (req, res) => {
    try {
        const {
            ffmpeg_command,
            input_files,
            output_files,
            max_command_run_seconds = 300,
            vcpu_count = 8,
            metadata,
            input_compressed_folder
        } = req.body;

        // التحقق من الحقول المطلوبة
        if (!ffmpeg_command) {
            return res.status(422).json({
                detail: [{ loc: ['body', 'ffmpeg_command'], msg: 'Field required', type: 'missing' }]
            });
        }

        if (!output_files) {
            return res.status(422).json({
                detail: [{ loc: ['body', 'output_files'], msg: 'Field required', type: 'missing' }]
            });
        }

        // التحقق من صحة المفاتيح
        try { validateKeys(input_files, output_files); } catch (error) {
            return res.status(422).json({
                detail: [{ loc: ['body', 'input_files'], msg: error.message, type: 'value_error' }]
            });
        }

        const commandId = uuidv4();
        const repo = getNextRepo();
        
        // تحضير مدخلات workflow
        const workflowInputs = {
            ffmpeg_command,
            input_files_json: JSON.stringify(input_files || {}),
            output_files_json: JSON.stringify(output_files),
            max_command_run_seconds: max_command_run_seconds.toString(),
            vcpu_count: vcpu_count.toString(),
            metadata_json: JSON.stringify(metadata || {}),
            command_id: commandId,
            input_compressed_folder: input_compressed_folder || ''
        };

        // تشغيل workflow
        const runId = await triggerWorkflow(repo, workflowInputs);
        
        if (!runId) throw new Error('لم يتم العثور على run ID');

        // تخزين المهمة
        const job = {
            command_id: commandId,
            repo,
            run_id: runId,
            status: 'PROCESSING',
            original_request: req.body,
            output_files,
            metadata: metadata || {},
            created_at: Date.now(),
            command_type: 'FFMPEG_COMMAND'
        };
        
        jobs.set(commandId, job);
        saveJobs();

        console.log(`✅ مهمة جديدة: ${commandId} → ${repo}`);

        // رد مطابق لـ Rendi
        res.json({ command_id: commandId });

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ detail: error.message });
    }
});

// POST /v1/run-chained-ffmpeg-commands
app.post('/v1/run-chained-ffmpeg-commands', authMiddleware, async (req, res) => {
    try {
        const {
            input_files,
            output_files,
            ffmpeg_commands,
            max_command_run_seconds = 300,
            vcpu_count = 8,
            metadata
        } = req.body;

        if (!ffmpeg_commands || !Array.isArray(ffmpeg_commands) || ffmpeg_commands.length === 0) {
            return res.status(422).json({
                detail: [{ loc: ['body', 'ffmpeg_commands'], msg: 'يجب أن تكون مصفوفة غير فارغة', type: 'type_error' }]
            });
        }

        if (ffmpeg_commands.length > 10) {
            return res.status(422).json({
                detail: [{ loc: ['body', 'ffmpeg_commands'], msg: 'الحد الأقصى 10 أوامر', type: 'value_error' }]
            });
        }

        // دمج الأوامر المتسلسلة
        const combinedCommand = ffmpeg_commands.join(' && ');
        
        req.body.ffmpeg_command = combinedCommand;
        req.body.command_type = 'FFMPEG_CHAINED_COMMANDS';
        
        return app._router.handle(req, res);

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.status(500).json({ detail: error.message });
    }
});

// GET /v1/commands/:command_id
app.get('/v1/commands/:command_id', authMiddleware, async (req, res) => {
    try {
        const { command_id } = req.params;
        const job = jobs.get(command_id);

        if (!job) {
            return res.status(404).json({ detail: 'الأمر غير موجود' });
        }

        // فحص حالة GitHub Actions
        const runData = await checkRunStatus(job.repo, job.run_id);
        
        const statusMap = {
            'queued': 'QUEUED',
            'in_progress': 'PROCESSING',
            'pending': 'QUEUED',
            'waiting': 'QUEUED'
        };

        // لسه يشتغل
        if (runData.status !== 'completed') {
            return res.json({
                command_id,
                status: statusMap[runData.status] || 'PROCESSING',
                command_type: job.command_type || 'FFMPEG_COMMAND',
                original_request: job.original_request,
                metadata: job.metadata
            });
        }

        // فشل
        if (runData.conclusion !== 'success') {
            jobs.set(command_id, { ...job, status: 'FAILED' });
            saveJobs();
            
            return res.json({
                command_id,
                status: 'FAILED',
                command_type: job.command_type || 'FFMPEG_COMMAND',
                error_status: 'PROCESSING_ERROR',
                error_message: 'فشل تنفيذ أمر FFmpeg',
                original_request: job.original_request,
                metadata: job.metadata
            });
        }

        // نجاح!
        let outputFiles = {};
        try {
            const logs = await getWorkflowLogs(job.repo, job.run_id);
            outputFiles = extractOutputFiles(logs, job.output_files);
        } catch (e) {
            console.error('خطأ في جلب السجلات:', e);
            if (job.output_files && typeof job.output_files === 'object') {
                for (const [key, filename] of Object.entries(job.output_files)) {
                    outputFiles[key] = {
                        storage_url: `${R2_PUBLIC_URL}/${filename}`,
                        url: `${R2_PUBLIC_URL}/${filename}`,
                        file_id: uuidv4(),
                        status: 'STORED',
                        file_type: 'video',
                        mime_type: 'video/mp4'
                    };
                }
            }
        }

        const processingTime = (Date.now() - job.created_at) / 1000;
        jobs.set(command_id, { ...job, status: 'SUCCESS' });
        saveJobs();

        return res.json({
            command_id,
            status: 'SUCCESS',
            command_type: job.command_type || 'FFMPEG_COMMAND',
            total_processing_seconds: processingTime,
            output_files: outputFiles,
            original_request: job.original_request,
            metadata: job.metadata,
            vcpu_count: job.original_request.vcpu_count || 8
        });

    } catch (error) {
        console.error('❌ خطأ:', error);
        res.json({
            command_id: req.params.command_id,
            status: 'PROCESSING',
            command_type: 'FFMPEG_COMMAND'
        });
    }
});

// فحص الصحة
app.get('/health', (req, res) => {
    const activeJobs = Array.from(jobs.values()).filter(j => 
        j.status === 'PROCESSING' || j.status === 'QUEUED'
    ).length;
    
    res.json({ ok: true, active_jobs: activeJobs, total_jobs: jobs.size });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
    res.json({
        service: 'FFmpeg API - بديل Rendi.dev مجاني',
        version: '1.0.0',
        endpoints: ['/v1/run-ffmpeg-command', '/v1/run-chained-ffmpeg-commands', '/v1/commands/:id', '/health']
    });
});

// تشغيل السيرفر
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 السيرفر شغال على المنفذ ${PORT}`);
    console.log(`👷 العمال: ${WORKER_REPOS.length}`);
    console.log(`👤 المستخدم: ${GITHUB_USERNAME}`);
});
