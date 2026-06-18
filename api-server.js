import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const app = express();
app.use(express.json());

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const API_KEY = process.env.API_KEY;

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

function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const emoji = { INFO: '📘', SUCCESS: '✅', ERROR: '❌', WARN: '⚠️', WORKER: '👷', VIDEO: '🎬', REMOTION: '🎨', FFMPEG: '🎥', UPLOAD: '📤', STATUS: '📊' };
    console.log(`${emoji[level] || '📝'} [${timestamp}] ${message}`);
    if (Object.keys(data).length > 0) console.log(`   📋 Details:`, JSON.stringify(data, null, 2));
}

function loadJobs() {
    try { if (fs.existsSync('jobs-backup.json')) { const data = fs.readFileSync('jobs-backup.json', 'utf8'); jobs = new Map(JSON.parse(data)); log('INFO', `Loaded ${jobs.size} jobs`); } } catch (e) { log('INFO', 'Fresh start'); }
}

function saveJobs() {
    try { fs.writeFileSync('jobs-backup.json', JSON.stringify(Array.from(jobs.entries()))); } catch (e) { log('ERROR', 'Save failed', { error: e.message }); }
}

loadJobs();
setInterval(saveJobs, 30000);
setInterval(() => { const now = Date.now(); let c = 0; for (const [id, job] of jobs) { if (now - job.created_at > 3600000) { jobs.delete(id); c++; } } if (c > 0) log('INFO', `Cleaned ${c} jobs`); saveJobs(); }, 3600000);

function authMiddleware(req, res, next) {
    if (API_KEY && req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ detail: 'Invalid authorization key' });
    next();
}

function getNextRepo() { const repo = WORKER_REPOS[currentRepoIndex % WORKER_REPOS.length]; currentRepoIndex++; log('WORKER', `Selected`, { worker: repo }); return repo; }

function validateKeys(input_files, output_files) {
    if (input_files) for (const key of Object.keys(input_files)) { if (!key.startsWith('in_')) throw new Error(`Input key "${key}" must start with "in_"`); }
    if (output_files && output_files !== 'OUTPUT_FOLDER') for (const key of Object.keys(output_files)) { if (!key.startsWith('out_')) throw new Error(`Output key "${key}" must start with "out_"`); }
}

async function triggerWorkflow(repo, inputs) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/workflows/render-video.yml/dispatches`;
    log('VIDEO', `Triggering on ${repo}`, { worker: repo, command_id: inputs.command_id, engine: inputs.engine || 'ffmpeg' });
    const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: 'main', inputs }) });
    if (response.status !== 204) { const errorText = await response.text(); log('ERROR', `Trigger failed on ${repo}`, { status: response.status, error: errorText.substring(0, 300) }); throw new Error(`GitHub API error on ${repo}: ${response.status}`); }
    log('SUCCESS', `Triggered on ${repo}`);
    await new Promise(resolve => setTimeout(resolve, 4000));
    const runsRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs?per_page=1`, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
    const runsData = await runsRes.json();
    const runId = runsData.workflow_runs?.[0]?.id || null;
    log('INFO', `Run ID: ${runId}`, { worker: repo, run_id: runId });
    return runId;
}

async function checkRunStatus(repo, runId) {
    const data = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}`, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }).then(r => r.json());
    log('STATUS', `Run status`, { worker: repo, run_id: runId, status: data.status, conclusion: data.conclusion });
    return data;
}

async function getWorkflowLogs(repo, runId) {
    const logs = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}/logs`, { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }).then(r => r.text());
    const errorLines = logs.split('\n').filter(line => line.includes('FFMPEG_ERROR:') || line.includes('Error:') || line.includes('❌') || line.includes('SyntaxError:') || line.includes('failed'));
    if (errorLines.length > 0) log('ERROR', `Errors in ${repo}`, { worker: repo, errors: errorLines.slice(-10).map(e => e.substring(0, 200)) });
    return logs;
}

function extractOutputFiles(logs, outputFiles) {
    const results = {};
    for (const line of logs.split('\n')) { const match = line.match(/VIDEO_URL_RESULT_(\w+)=(.+)/); if (match) { results[match[1]] = { storage_url: match[2].trim(), url: match[2].trim(), file_id: uuidv4(), status: 'STORED', file_type: 'video', mime_type: 'video/mp4' }; } }
    if (Object.keys(results).length === 0 && outputFiles && typeof outputFiles === 'object') for (const [key, filename] of Object.entries(outputFiles)) { const url = `${R2_PUBLIC_URL}/${filename}`; results[key] = { storage_url: url, url: url, file_id: uuidv4(), status: 'STORED', file_type: 'video', mime_type: 'video/mp4' }; }
    return results;
}

// ============== API ENDPOINTS ==============

app.post('/v1/run-ffmpeg-command', authMiddleware, async (req, res) => {
    try {
        const { ffmpeg_command = '', input_files = {}, output_files = {}, command_id = uuidv4(), max_command_run_seconds = '300', vcpu_count = '8', metadata = {}, input_compressed_folder = '', engine = 'ffmpeg', remotion_props_json = '{}', remotion_component_url = '', duration = '5', fps = '30', width = '1080', height = '1920' } = req.body;
        const repo = getNextRepo();
        log('VIDEO', `New request`, { command_id, engine, worker: repo });

        // ========== REMOTION ==========
        if (engine === 'remotion') {
            log('REMOTION', `Processing`, { command_id });
            const runId = await triggerWorkflow(repo, { engine: 'remotion', remotion_props_json, output_files_json: JSON.stringify(output_files), duration, fps, width, height, command_id, remotion_component_url });
            const job = { command_id, status: 'PROCESSING', repo, run_id: runId, created_at: Date.now(), type: 'REMOTION', original_request: req.body, output_files, metadata: metadata || {} };
            jobs.set(command_id, job);
            saveJobs();
            log('SUCCESS', `Remotion started`, { command_id, worker: repo, run_id: runId });
            return res.json({ command_id, status: 'PROCESSING', worker: repo, run_id: runId });
        }

        // ========== FFMPEG ==========
        if (!ffmpeg_command) { log('ERROR', 'ffmpeg_command missing'); return res.status(422).json({ detail: [{ loc: ['body', 'ffmpeg_command'], msg: 'Field required', type: 'missing' }] }); }
        try { validateKeys(input_files, output_files); } catch (error) { return res.status(422).json({ detail: [{ loc: ['body', 'input_files'], msg: error.message, type: 'value_error' }] }); }
        log('FFMPEG', `Processing`, { command: ffmpeg_command.substring(0, 100) });
        const runId = await triggerWorkflow(repo, { ffmpeg_command, input_files_json: JSON.stringify(input_files || {}), output_files_json: JSON.stringify(output_files), max_command_run_seconds: max_command_run_seconds.toString(), command_id, input_compressed_folder: input_compressed_folder || '' });
        if (!runId) throw new Error('Run ID not found');
        const job = { command_id, repo, run_id: runId, status: 'PROCESSING', original_request: req.body, output_files, metadata: metadata || {}, created_at: Date.now(), command_type: 'FFMPEG_COMMAND' };
        jobs.set(command_id, job);
        saveJobs();
        log('SUCCESS', `FFmpeg started`, { command_id, worker: repo, run_id: runId });
        res.json({ command_id, status: 'PROCESSING', worker: repo, run_id: runId });
    } catch (error) { log('ERROR', 'Request failed', { error: error.message }); res.status(500).json({ detail: error.message }); }
});

app.post('/v1/run-chained-ffmpeg-commands', authMiddleware, async (req, res) => {
    try {
        const { input_files, output_files, ffmpeg_commands, max_command_run_seconds = 300, metadata } = req.body;
        if (!ffmpeg_commands || !Array.isArray(ffmpeg_commands) || ffmpeg_commands.length === 0) return res.status(422).json({ detail: [{ loc: ['body', 'ffmpeg_commands'], msg: 'Array required', type: 'type_error' }] });
        if (ffmpeg_commands.length > 10) return res.status(422).json({ detail: [{ loc: ['body', 'ffmpeg_commands'], msg: 'Max 10 commands', type: 'value_error' }] });
        const command_id = uuidv4(), repo = getNextRepo();
        log('FFMPEG', `Chained (${ffmpeg_commands.length})`, { command_id, worker: repo });
        const runId = await triggerWorkflow(repo, { ffmpeg_command: ffmpeg_commands.join(' && '), input_files_json: JSON.stringify(input_files || {}), output_files_json: JSON.stringify(output_files), max_command_run_seconds: max_command_run_seconds.toString(), command_id });
        if (!runId) throw new Error('Run ID not found');
        const job = { command_id, repo, run_id: runId, status: 'PROCESSING', original_request: req.body, output_files, metadata: metadata || {}, created_at: Date.now(), command_type: 'FFMPEG_CHAINED_COMMANDS' };
        jobs.set(command_id, job); saveJobs();
        log('SUCCESS', `Chained started`, { command_id, worker: repo });
        res.json({ command_id, status: 'PROCESSING', worker: repo });
    } catch (error) { log('ERROR', 'Chained failed', { error: error.message }); res.status(500).json({ detail: error.message }); }
});

app.get('/v1/commands/:command_id', authMiddleware, async (req, res) => {
    try {
        const { command_id } = req.params;
        const job = jobs.get(command_id);
        if (!job) { log('WARN', `Not found: ${command_id}`); return res.status(404).json({ detail: 'Command not found' }); }
        log('STATUS', `Checking: ${command_id}`, { worker: job.repo, status: job.status, type: job.type });

        // ========== REMOTION - Return URL immediately ==========
        if (job.type === 'REMOTION') {
            const outputFiles = {};
            for (const [key, filename] of Object.entries(job.output_files || {})) {
                const url = `${R2_PUBLIC_URL}/${filename}`;
                outputFiles[key] = { storage_url: url, url: url, file_id: uuidv4(), status: 'STORED', file_type: 'video', mime_type: 'video/mp4' };
            }
            jobs.set(command_id, { ...job, status: 'SUCCESS' });
            saveJobs();
            const processingTime = (Date.now() - job.created_at) / 1000;
            log('SUCCESS', `Remotion ready!`, { command_id, worker: job.repo, time: processingTime + 's', files: Object.keys(outputFiles).join(', ') });
            return res.json({ command_id, status: 'SUCCESS', command_type: 'REMOTION_COMMAND', total_processing_seconds: processingTime, output_files: outputFiles, worker: job.repo, original_request: job.original_request, metadata: job.metadata });
        }

        // ========== FFMPEG - Check GitHub Run ==========
        if (!job.run_id) return res.json({ command_id, status: job.status, command_type: job.command_type || 'FFMPEG_COMMAND', worker: job.repo, original_request: job.original_request, metadata: job.metadata });
        const runData = await checkRunStatus(job.repo, job.run_id);
        const statusMap = { 'queued': 'QUEUED', 'in_progress': 'PROCESSING', 'pending': 'QUEUED', 'waiting': 'QUEUED' };
        if (runData.status !== 'completed') return res.json({ command_id, status: statusMap[runData.status] || 'PROCESSING', command_type: job.command_type || 'FFMPEG_COMMAND', worker: job.repo, original_request: job.original_request, metadata: job.metadata });
        
        if (runData.conclusion !== 'success') {
            jobs.set(command_id, { ...job, status: 'FAILED' }); saveJobs();
            let errorMessage = 'Command failed';
            try { const logs = await getWorkflowLogs(job.repo, job.run_id); const errorLines = logs.split('\n').filter(line => line.includes('FFMPEG_ERROR:') || line.includes('Error:') || line.includes('❌') || line.includes('SyntaxError:') || line.includes('Cannot') || line.includes('failed') || line.includes('Illegal option')); if (errorLines.length > 0) errorMessage = errorLines.slice(-5).join(' | ').substring(0, 500); } catch (e) { errorMessage = 'Failed: ' + runData.conclusion; }
            log('ERROR', `Failed on ${job.repo}`, { command_id, worker: job.repo, error: errorMessage.substring(0, 200) });
            return res.json({ command_id, status: 'FAILED', command_type: job.command_type || 'FFMPEG_COMMAND', error_status: 'PROCESSING_ERROR', error_message: errorMessage, worker: job.repo, original_request: job.original_request, metadata: job.metadata });
        }

        let outputFiles = {};
        try { const logs = await getWorkflowLogs(job.repo, job.run_id); outputFiles = extractOutputFiles(logs, job.output_files); } catch (e) { if (job.output_files && typeof job.output_files === 'object') for (const [key, filename] of Object.entries(job.output_files)) { const url = `${R2_PUBLIC_URL}/${filename}`; outputFiles[key] = { storage_url: url, url: url, file_id: uuidv4(), status: 'STORED', file_type: 'video', mime_type: 'video/mp4' }; } }
        const processingTime = (Date.now() - job.created_at) / 1000;
        jobs.set(command_id, { ...job, status: 'SUCCESS' }); saveJobs();
        log('SUCCESS', `Video ready!`, { command_id, worker: job.repo, time: processingTime + 's', files: Object.keys(outputFiles).join(', ') });
        return res.json({ command_id, status: 'SUCCESS', command_type: job.command_type || 'FFMPEG_COMMAND', total_processing_seconds: processingTime, output_files: outputFiles, worker: job.repo, original_request: job.original_request, metadata: job.metadata, vcpu_count: job.original_request.vcpu_count || 8 });
    } catch (error) { log('ERROR', 'Status check failed', { error: error.message }); res.json({ command_id: req.params.command_id, status: 'PROCESSING', command_type: 'FFMPEG_COMMAND' }); }
});

app.get('/health', (req, res) => { const activeJobs = Array.from(jobs.values()).filter(j => j.status === 'PROCESSING' || j.status === 'QUEUED').length; res.json({ ok: true, active_jobs: activeJobs, total_jobs: jobs.size }); });

app.get('/', (req, res) => { res.json({ service: 'FFmpeg API - Free Rendi.dev Alternative', version: '2.0.0', engines: ['ffmpeg', 'remotion'], workers: WORKER_REPOS, endpoints: ['/v1/run-ffmpeg-command', '/v1/run-chained-ffmpeg-commands', '/v1/commands/:id', '/health'] }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`🚀 Server running on port ${PORT}`); console.log(`👷 Workers: ${WORKER_REPOS.length}`); console.log(`👤 User: ${GITHUB_USERNAME}`); console.log(`🎬 Engines: FFmpeg + Remotion`); });
