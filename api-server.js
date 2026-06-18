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
    }
}

function saveJobs() {
    try { 
        fs.writeFileSync('jobs-backup.json', JSON.stringify(Array.from(jobs.entries()))); 
    } catch (e) { 
        log('ERROR', 'Save failed', { error: e.message }); 
    }
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
    if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
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
        throw new Error(`GitHub API error on ${repo}: ${response.status} - ${errorText.substring(0, 200)}`); 
    }
    
    log('SUCCESS', `Workflow triggered on ${repo}`);
    
    // Wait longer for workflow to appear in runs list
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Get the latest workflow run
    const runsRes = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs?per_page=1`, 
        { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
    );
    const runsData = await runsRes.json();
    const runId = runsData.workflow_runs?.[0]?.id || null;
    
    if (!runId) {
        log('ERROR', `Could not find run ID for triggered workflow`, { worker: repo });
        throw new Error('Could not find workflow run ID');
    }
    
    log('INFO', `Workflow run ID`, { worker: repo, run_id: runId });
    return runId;
}

async function checkRunStatus(repo, runId) {
    try {
        const response = await fetch(
            `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}`, 
            { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
        );
        
        if (!response.ok) {
            log('ERROR', `Failed to check run status`, { 
                worker: repo, 
                run_id: runId, 
                status: response.status 
            });
            return null;
        }
        
        const data = await response.json();
        log('STATUS', `Run status check`, { 
            worker: repo, 
            run_id: runId, 
            status: data.status, 
            conclusion: data.conclusion 
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
        
        if (!response.ok) {
            return '';
        }
        
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

// ============== API ENDPOINTS ==============

app.post('/v1/run-ffmpeg-command', authMiddleware, async (req, res) => {
    try {
        const { 
            ffmpeg_command = '', 
            input_files = {}, 
            output_files = {}, 
            command_id = uuidv4(), 
            max_command_run_seconds = '300', 
            vcpu_count = '8', 
            metadata = {}, 
            input_compressed_folder = '', 
            engine = 'ffmpeg', 
            remotion_props_json = '{}', 
            remotion_component_url = '', 
            duration = '5', 
            fps = '30', 
            width = '1080', 
            height = '1920' 
        } = req.body;
        
        const repo = getNextRepo();
        log('VIDEO', `New video request`, { command_id, engine, worker: repo });

        // ========== REMOTION ==========
        if (engine === 'remotion') {
            log('REMOTION', `Processing Remotion request`, { command_id });
            
            const runId = await triggerWorkflow(repo, { 
                engine: 'remotion', 
                remotion_props_json, 
                output_files_json: JSON.stringify(output_files), 
                duration, fps, width, height, 
                command_id, 
                remotion_component_url 
            });
            
            const job = { 
                command_id, 
                status: 'PROCESSING', 
                repo, 
                run_id: runId, 
                created_at: Date.now(), 
                type: 'REMOTION', 
                original_request: req.body, 
                output_files, 
                metadata: metadata || {} 
            };
            
            jobs.set(command_id, job);
            saveJobs();
            
            log('SUCCESS', `Remotion job started`, { command_id, worker: repo, run_id: runId });
            
            return res.json({ 
                command_id, 
                status: 'PROCESSING', 
                worker: repo, 
                run_id: runId 
            });
        }

        // ========== FFMPEG ==========
        if (!ffmpeg_command) { 
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
            command: ffmpeg_command.substring(0, 100) + '...' 
        });
        
        const runId = await triggerWorkflow(repo, { 
            ffmpeg_command, 
            input_files_json: JSON.stringify(input_files || {}), 
            output_files_json: JSON.stringify(output_files), 
            max_command_run_seconds: max_command_run_seconds.toString(), 
            command_id, 
            input_compressed_folder: input_compressed_folder || '' 
        });
        
        const job = { 
            command_id, 
            repo, 
            run_id: runId, 
            status: 'PROCESSING', 
            original_request: req.body, 
            output_files, 
            metadata: metadata || {}, 
            created_at: Date.now(), 
            command_type: 'FFMPEG_COMMAND' 
        };
        
        jobs.set(command_id, job);
        saveJobs();
        
        log('SUCCESS', `FFmpeg job started`, { command_id, worker: repo, run_id: runId });
        
        res.json({ 
            command_id, 
            status: 'PROCESSING', 
            worker: repo, 
            run_id: runId 
        });
        
    } catch (error) { 
        log('ERROR', 'Request failed', { error: error.message }); 
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
            log('WARN', `Command not found: ${command_id}`); 
            return res.status(404).json({ 
                status: 'FAILED',
                detail: 'Command not found' 
            }); 
        }
        
        log('STATUS', `Checking command status`, { 
            command_id, 
            worker: job.repo, 
            current_status: job.status, 
            type: job.type 
        });

        // Return immediately if already in final state
        if (job.status === 'SUCCESS' || job.status === 'FAILED') {
            return res.json({
                command_id,
                status: job.status,
                command_type: job.command_type || 'FFMPEG_COMMAND',
                output_files: job.output_files || {},
                worker: job.repo,
                original_request: job.original_request,
                metadata: job.metadata,
                ...(job.status === 'FAILED' && { error_message: job.error_message || 'Processing failed' })
            });
        }

        // Check GitHub workflow status
        if (!job.run_id) {
            return res.json({ 
                command_id, 
                status: job.status, 
                command_type: job.command_type || 'FFMPEG_COMMAND', 
                worker: job.repo, 
                original_request: job.original_request, 
                metadata: job.metadata 
            });
        }
        
        const runData = await checkRunStatus(job.repo, job.run_id);
        
        if (!runData) {
            // If we can't check status, return current status
            return res.json({ 
                command_id, 
                status: job.status, 
                command_type: job.command_type || 'FFMPEG_COMMAND', 
                worker: job.repo, 
                original_request: job.original_request, 
                metadata: job.metadata 
            });
        }
        
        const statusMap = { 
            'queued': 'PROCESSING', 
            'in_progress': 'PROCESSING', 
            'pending': 'PROCESSING', 
            'waiting': 'PROCESSING' 
        };
        
        if (runData.status !== 'completed') {
            return res.json({ 
                command_id, 
                status: statusMap[runData.status] || 'PROCESSING', 
                command_type: job.command_type || 'FFMPEG_COMMAND', 
                worker: job.repo, 
                original_request: job.original_request, 
                metadata: job.metadata 
            });
        }
        
        // Workflow completed - check conclusion
        if (runData.conclusion !== 'success') {
            let errorMessage = 'Command processing failed';
            
            try { 
                const logs = await getWorkflowLogs(job.repo, job.run_id); 
                if (logs) {
                    const errorLines = logs.split('\n').filter(line => 
                        line.includes('FFMPEG_ERROR:') || 
                        line.includes('Error:') || 
                        line.includes('❌') || 
                        line.includes('SyntaxError:') || 
                        line.includes('Cannot') || 
                        line.includes('failed') || 
                        line.includes('Illegal option') ||
                        line.includes('FATAL')
                    ); 
                    if (errorLines.length > 0) {
                        errorMessage = errorLines.slice(-5).join(' | ').substring(0, 500);
                    }
                }
            } catch (e) { 
                errorMessage = `Workflow failed with conclusion: ${runData.conclusion}`; 
            }
            
            jobs.set(command_id, { 
                ...job, 
                status: 'FAILED',
                error_message: errorMessage
            });
            saveJobs();
            
            log('ERROR', `Job failed on ${job.repo}`, { 
                command_id, 
                worker: job.repo, 
                error: errorMessage.substring(0, 200) 
            });
            
            return res.json({ 
                command_id, 
                status: 'FAILED', 
                command_type: job.command_type || 'FFMPEG_COMMAND', 
                error_status: 'PROCESSING_ERROR', 
                error_message: errorMessage, 
                worker: job.repo, 
                original_request: job.original_request, 
                metadata: job.metadata 
            });
        }
        
        // Success!
        let outputFiles = {};
        try { 
            const logs = await getWorkflowLogs(job.repo, job.run_id); 
            outputFiles = extractOutputFiles(logs, job.output_files); 
        } catch (e) { 
            log('WARN', `Could not extract output files`, { error: e.message });
            // Fallback to constructing URLs
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
        }
        
        const processingTime = (Date.now() - job.created_at) / 1000;
        
        jobs.set(command_id, { 
            ...job, 
            status: 'SUCCESS',
            output_files: outputFiles
        });
        saveJobs();
        
        log('SUCCESS', `Video processing completed!`, { 
            command_id, 
            worker: job.repo, 
            time: processingTime.toFixed(1) + 's', 
            files: Object.keys(outputFiles).join(', ') 
        });
        
        return res.json({ 
            command_id, 
            status: 'SUCCESS', 
            command_type: job.command_type || 'FFMPEG_COMMAND', 
            total_processing_seconds: processingTime, 
            output_files: outputFiles, 
            worker: job.repo, 
            original_request: job.original_request, 
            metadata: job.metadata 
        });
        
    } catch (error) { 
        log('ERROR', 'Status check failed', { error: error.message }); 
        res.status(500).json({ 
            status: 'FAILED',
            command_id: req.params.command_id,
            detail: error.message
        }); 
    }
});

app.get('/health', (req, res) => { 
    const activeJobs = Array.from(jobs.values()).filter(j => 
        j.status === 'PROCESSING'
    ).length; 
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
        version: '3.0.0', 
        engines: ['ffmpeg', 'remotion'], 
        workers: WORKER_REPOS, 
        endpoints: [
            '/v1/run-ffmpeg-command', 
            '/v1/commands/:id', 
            '/health'
        ] 
    }); 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
    console.log(`🚀 Server running on port ${PORT}`); 
    console.log(`👷 Workers: ${WORKER_REPOS.length}`); 
    console.log(`👤 User: ${GITHUB_USERNAME}`); 
    console.log(`🎬 Engines: FFmpeg + Remotion`); 
});

export default app;
