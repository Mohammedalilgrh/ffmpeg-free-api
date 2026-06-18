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
    try { 
        if (fs.existsSync('jobs-backup.json')) { 
            const data = fs.readFileSync('jobs-backup.json', 'utf8'); 
            jobs = new Map(JSON.parse(data)); 
            log('INFO', `Loaded ${jobs.size} jobs`); 
        } 
    } catch (e) { 
        log('INFO', 'Fresh start'); 
        jobs = new Map();
    }
}

function saveJobs() {
    try { 
        fs.writeFileSync('jobs-backup.json', JSON.stringify(Array.from(jobs.entries()))); 
    } catch (e) { 
        log('ERROR', 'Save failed', { error: e.message }); 
    }
}

// Safe string conversion helper
function ensureString(value, defaultValue = '') {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(' ');
    if (typeof value === 'object' && value !== null) {
        // If it has ffmpeg_command property
        if (value.ffmpeg_command) return ensureString(value.ffmpeg_command);
        // Otherwise stringify
        try {
            return JSON.stringify(value);
        } catch (e) {
            return String(value);
        }
    }
    return String(value || defaultValue);
}

loadJobs();
setInterval(saveJobs, 30000);

// Clean up old jobs (older than 1 hour)
setInterval(() => { 
    const now = Date.now(); 
    let c = 0; 
    for (const [id, job] of jobs) { 
        if (now - job.created_at > 3600000 && job.status !== 'PROCESSING') { 
            jobs.delete(id); 
            c++; 
        } 
    } 
    if (c > 0) log('INFO', `Cleaned ${c} old jobs`); 
    saveJobs(); 
}, 3600000);

function authMiddleware(req, res, next) {
    // Check for API key in x-api-key header OR Authorization Bearer token
    const apiKey = req.headers['x-api-key'] || 
                   (req.headers['authorization']?.startsWith('Bearer ') ? 
                    req.headers['authorization'].substring(7) : null);
    
    if (API_KEY && apiKey !== API_KEY) {
        return res.status(401).json({ 
            detail: 'Invalid authorization key',
            status: 'FAILED'
        });
    }
    next();
}

function getNextRepo() { 
    const repo = WORKER_REPOS[currentRepoIndex % WORKER_REPOS.length]; 
    currentRepoIndex++; 
    log('WORKER', `Selected worker`, { worker: repo }); 
    return repo; 
}

function validateKeys(input_files, output_files) {
    if (input_files) {
        for (const key of Object.keys(input_files)) { 
            if (!key.startsWith('in_')) throw new Error(`Input key "${key}" must start with "in_"`); 
        }
    }
    if (output_files && output_files !== 'OUTPUT_FOLDER') {
        for (const key of Object.keys(output_files)) { 
            if (!key.startsWith('out_')) throw new Error(`Output key "${key}" must start with "out_"`); 
        }
    }
}

async function triggerWorkflow(repo, inputs) {
    const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/workflows/render-video.yml/dispatches`;
    log('VIDEO', `Triggering workflow on ${repo}`, { 
        worker: repo, 
        command_id: inputs.command_id, 
        engine: inputs.engine || 'ffmpeg' 
    });
    
    try {
        const response = await fetch(url, { 
            method: 'POST', 
            headers: { 
                'Authorization': `token ${GITHUB_TOKEN}`, 
                'Accept': 'application/vnd.github.v3+json', 
                'Content-Type': 'application/json' 
            }, 
            body: JSON.stringify({ ref: 'main', inputs }) 
        });
        
        if (response.status !== 204) { 
            const errorText = await response.text(); 
            log('ERROR', `Trigger failed on ${repo}`, { 
                status: response.status, 
                error: errorText.substring(0, 300) 
            }); 
            throw new Error(`GitHub API error: ${response.status} - ${errorText.substring(0, 200)}`); 
        }
        
        log('SUCCESS', `Workflow triggered on ${repo}`);
        
        // Wait for workflow to appear in runs list
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Try to get run ID with retries
        for (let i = 0; i < 5; i++) {
            const runsRes = await fetch(
                `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs?per_page=5&event=workflow_dispatch`, 
                { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
            );
            
            if (!runsRes.ok) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            
            const runsData = await runsRes.json();
            
            // Find the most recent run
            const matchingRun = runsData.workflow_runs?.find(run => {
                const runTime = new Date(run.created_at).getTime();
                const now = Date.now();
                return (now - runTime) < 120000; // Within 2 minutes
            });
            
            if (matchingRun?.id) {
                log('INFO', `Found run ID`, { worker: repo, run_id: matchingRun.id });
                return matchingRun.id;
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        log('WARN', `Could not find run ID, but workflow was triggered`);
        return null;
        
    } catch (error) {
        log('ERROR', `Failed to trigger workflow`, { error: error.message });
        throw error;
    }
}

async function checkRunStatus(repo, runId) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}`, 
            { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
        );
        
        if (!response.ok) {
            log('ERROR', `Failed to check status`, { status: response.status });
            return null;
        }
        
        const data = await response.json();
        log('STATUS', `Run ${runId}`, { 
            status: data.status, 
            conclusion: data.conclusion,
            worker: repo
        });
        
        return data;
    } catch (error) {
        log('ERROR', `Status check error`, { error: error.message });
        return null;
    }
}

async function getWorkflowLogs(repo, runId) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}/logs`, 
            { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
        );
        
        if (!response.ok) return '';
        
        const logs = await response.text();
        const errorLines = logs.split('\n').filter(line => 
            line.includes('FFMPEG_ERROR:') || 
            line.includes('Error:') || 
            line.includes('❌') || 
            line.includes('SyntaxError:') || 
            line.includes('failed') ||
            line.includes('FATAL')
        );
        
        if (errorLines.length > 0) {
            log('ERROR', `Errors found in workflow logs`, { 
                worker: repo, 
                errors: errorLines.slice(-10).map(e => e.substring(0, 200)) 
            });
        }
        
        return logs;
    } catch (error) {
        log('ERROR', `Failed to get workflow logs`, { error: error.message });
        return '';
    }
}

function extractOutputFiles(logs, outputFiles) {
    const results = {};
    
    // Try to extract URLs from logs
    for (const line of logs.split('\n')) { 
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
    
    // If no URLs found in logs, construct from output_files and R2_PUBLIC_URL
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

// Background status checker
async function checkAllProcessingJobs() {
    const processingJobs = Array.from(jobs.entries())
        .filter(([_, job]) => job.status === 'PROCESSING' && job.run_id);
    
    for (const [command_id, job] of processingJobs) {
        try {
            const runData = await checkRunStatus(job.repo, job.run_id);
            
            if (!runData) continue;
            
            if (runData.status === 'completed') {
                if (runData.conclusion === 'success') {
                    // Build output files
                    const outputFiles = {};
                    if (job.output_files && typeof job.output_files === 'object') {
                        for (const [key, filename] of Object.entries(job.output_files)) {
                            const url = `${R2_PUBLIC_URL}/${filename}`;
                            outputFiles[key] = {
                                storage_url: url,
                                url: url,
                                file_id: uuidv4(),
                                status: 'STORED',
                                file_type: 'video',
                                mime_type: 'video/mp4'
                            };
                        }
                    }
                    
                    jobs.set(command_id, {
                        ...job,
                        status: 'SUCCESS',
                        output_files: outputFiles,
                        completed_at: Date.now()
                    });
                    
                    log('SUCCESS', `Background: Job completed!`, { 
                        command_id, 
                        files: Object.keys(outputFiles).join(', ') 
                    });
                    
                } else {
                    jobs.set(command_id, {
                        ...job,
                        status: 'FAILED',
                        error_message: `Workflow failed: ${runData.conclusion}`,
                        completed_at: Date.now()
                    });
                    
                    log('ERROR', `Background: Job failed`, { command_id, conclusion: runData.conclusion });
                }
                
                saveJobs();
            }
        } catch (error) {
            log('ERROR', `Background check error`, { command_id, error: error.message });
        }
    }
}

// Run background checker every 30 seconds
setInterval(checkAllProcessingJobs, 30000);

// ============== API ENDPOINTS ==============

app.post('/v1/run-ffmpeg-command', authMiddleware, async (req, res) => {
    try {
        // ========== FIX: Handle all types of input ==========
        let { 
            ffmpeg_command, 
            input_files, 
            output_files, 
            command_id, 
            max_command_run_seconds,
            vcpu_count,
            metadata,
            input_compressed_folder,
            engine,
            remotion_props_json,
            remotion_component_url,
            duration,
            fps,
            width,
            height
        } = req.body;

        // Convert ffmpeg_command to string no matter what format it comes in
        ffmpeg_command = ensureString(ffmpeg_command);
        
        // Set defaults for missing values
        command_id = command_id || uuidv4();
        output_files = output_files || { out_1: 'output.mp4' };
        input_files = input_files || {};
        max_command_run_seconds = String(max_command_run_seconds || '600');
        engine = engine || 'ffmpeg';
        metadata = metadata || {};
        
        // Convert other fields that might be objects
        remotion_props_json = typeof remotion_props_json === 'string' ? 
            remotion_props_json : JSON.stringify(remotion_props_json || {});
        input_compressed_folder = ensureString(input_compressed_folder, '');
        remotion_component_url = ensureString(remotion_component_url, '');
        duration = String(duration || '5');
        fps = String(fps || '30');
        width = String(width || '1080');
        height = String(height || '1920');
        
        // Log what we received
        log('INFO', 'Request received', { 
            ffmpeg_command_type: typeof req.body.ffmpeg_command,
            ffmpeg_command_preview: ffmpeg_command.substring(0, 150),
            engine,
            command_id
        });
        // ========== END FIX ==========

        const repo = getNextRepo();
        log('VIDEO', `Processing request`, { command_id, engine, worker: repo });

        // ========== REMOTION ==========
        if (engine === 'remotion') {
            log('REMOTION', `Processing Remotion request`, { command_id });
            
            const job = {
                command_id,
                status: 'PROCESSING',
                repo,
                run_id: null,
                created_at: Date.now(),
                type: 'REMOTION',
                output_files,
                metadata: metadata || {},
                original_request: req.body
            };
            
            jobs.set(command_id, job);
            saveJobs();

            const runId = await triggerWorkflow(repo, { 
                engine: 'remotion', 
                remotion_props_json, 
                output_files_json: JSON.stringify(output_files), 
                duration, fps, width, height, 
                command_id, 
                remotion_component_url 
            });
            
            if (runId) {
                job.run_id = runId;
                jobs.set(command_id, job);
                saveJobs();
            }
            
            log('SUCCESS', `Remotion job started`, { command_id, worker: repo, run_id: runId });
            
            return res.json({ 
                command_id, 
                status: 'PROCESSING', 
                worker: repo, 
                run_id: runId 
            });
        }

        // ========== FFMPEG ==========
        if (!ffmpeg_command || ffmpeg_command.trim() === '') { 
            log('ERROR', 'Missing ffmpeg_command'); 
            return res.status(422).json({ 
                status: 'FAILED',
                detail: [{ 
                    loc: ['body', 'ffmpeg_command'], 
                    msg: 'ffmpeg_command is required', 
                    type: 'missing' 
                }] 
            }); 
        }
        
        try { 
            validateKeys(input_files, output_files); 
        } catch (error) { 
            return res.status(422).json({ 
                status: 'FAILED',
                detail: [{ 
                    loc: ['body', 'input_files'], 
                    msg: error.message, 
                    type: 'value_error' 
                }] 
            }); 
        }
        
        log('FFMPEG', `Processing FFmpeg command`, { 
            command_preview: ffmpeg_command.substring(0, 100) + '...' 
        });
        
        const job = {
            command_id,
            status: 'PROCESSING',
            repo,
            run_id: null,
            created_at: Date.now(),
            type: 'FFMPEG',
            output_files,
            metadata: metadata || {},
            original_request: req.body
        };
        
        jobs.set(command_id, job);
        saveJobs();

        const runId = await triggerWorkflow(repo, { 
            ffmpeg_command, 
            input_files_json: JSON.stringify(input_files), 
            output_files_json: JSON.stringify(output_files), 
            max_command_run_seconds: max_command_run_seconds, 
            command_id, 
            input_compressed_folder 
        });
        
        if (runId) {
            job.run_id = runId;
            jobs.set(command_id, job);
            saveJobs();
        }
        
        log('SUCCESS', `FFmpeg job started`, { command_id, worker: repo, run_id: runId });
        
        res.json({ 
            command_id, 
            status: 'PROCESSING', 
            worker: repo, 
            run_id: runId 
        });
        
    } catch (error) { 
        log('ERROR', 'Request failed', { error: error.message, stack: error.stack }); 
        res.status(500).json({ 
            status: 'FAILED',
            detail: error.message 
        }); 
    }
});

app.get('/v1/commands/:command_id', authMiddleware, async (req, res) => {
    try {
        const { command_id } = req.params;
        const job = jobs.get(command_id);
        
        if (!job) { 
            return res.status(404).json({ 
                status: 'FAILED',
                detail: 'Command not found' 
            }); 
        }
        
        log('STATUS', `Checking: ${command_id}`, { 
            status: job.status, 
            worker: job.repo 
        });
        
        // Return current status immediately
        const response = {
            command_id,
            status: job.status,
            command_type: job.type === 'REMOTION' ? 'REMOTION_COMMAND' : 'FFMPEG_COMMAND',
            worker: job.repo,
            original_request: job.original_request,
            metadata: job.metadata || {}
        };
        
        // Add success data if available
        if (job.status === 'SUCCESS') {
            response.output_files = job.output_files || {};
            response.total_processing_seconds = ((job.completed_at || Date.now()) - job.created_at) / 1000;
        }
        
        // Add error data if failed
        if (job.status === 'FAILED') {
            response.error_message = job.error_message || 'Processing failed';
            response.error_status = 'PROCESSING_ERROR';
        }
        
        res.json(response);
        
    } catch (error) { 
        log('ERROR', 'Status check failed', { error: error.message }); 
        res.status(500).json({ 
            status: 'FAILED',
            detail: error.message 
        }); 
    }
});

// Force check endpoint
app.post('/v1/commands/:command_id/check', authMiddleware, async (req, res) => {
    try {
        const { command_id } = req.params;
        const job = jobs.get(command_id);
        
        if (!job) {
            return res.status(404).json({ status: 'FAILED', detail: 'Not found' });
        }
        
        if (!job.run_id) {
            return res.json({ status: job.status, message: 'No run ID yet' });
        }
        
        const runData = await checkRunStatus(job.repo, job.run_id);
        
        if (runData && runData.status === 'completed') {
            if (runData.conclusion === 'success') {
                job.status = 'SUCCESS';
                job.completed_at = Date.now();
                
                const outputFiles = {};
                if (job.output_files && typeof job.output_files === 'object') {
                    for (const [key, filename] of Object.entries(job.output_files)) {
                        const url = `${R2_PUBLIC_URL}/${filename}`;
                        outputFiles[key] = {
                            storage_url: url,
                            url: url,
                            file_id: uuidv4(),
                            status: 'STORED',
                            file_type: 'video',
                            mime_type: 'video/mp4'
                        };
                    }
                }
                job.output_files = outputFiles;
            } else {
                job.status = 'FAILED';
                job.error_message = `Workflow failed: ${runData.conclusion}`;
                job.completed_at = Date.now();
            }
            
            jobs.set(command_id, job);
            saveJobs();
        }
        
        res.json({
            command_id,
            status: job.status,
            github_status: runData?.status,
            github_conclusion: runData?.conclusion
        });
        
    } catch (error) {
        res.status(500).json({ status: 'FAILED', detail: error.message });
    }
});

app.get('/health', (req, res) => { 
    const activeJobs = Array.from(jobs.values()).filter(j => j.status === 'PROCESSING').length; 
    res.json({ 
        ok: true, 
        active_jobs: activeJobs, 
        total_jobs: jobs.size,
        workers: WORKER_REPOS.length
    }); 
});

app.get('/', (req, res) => { 
    res.json({ 
        service: 'FFmpeg API - Video Processing Service', 
        version: '4.0.1', 
        engines: ['ffmpeg', 'remotion'], 
        auth_methods: ['x-api-key header', 'Authorization Bearer token'],
        endpoints: [
            'POST /v1/run-ffmpeg-command',
            'GET /v1/commands/:id',
            'POST /v1/commands/:id/check',
            'GET /health'
        ] 
    }); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`🚀 Server running on port ${PORT}`); 
    console.log(`👷 Workers: ${WORKER_REPOS.length}`); 
    console.log(`👤 User: ${GITHUB_USERNAME}`);
    console.log(`🔄 Background status checker running every 30s`);
    console.log(`🔑 Auth: x-api-key header OR Authorization Bearer token`);
});

export default app;
