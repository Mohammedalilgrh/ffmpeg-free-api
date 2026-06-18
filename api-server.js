import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const app = express();
app.use(express.json({ limit: '50mb' }));

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

// ─────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const emoji = {
    INFO: '📘', SUCCESS: '✅', ERROR: '❌',
    WARN: '⚠️', WORKER: '👷', VIDEO: '🎬',
    REMOTION: '🎨', FFMPEG: '🎥', UPLOAD: '📤', STATUS: '📊'
  };
  console.log(`${emoji[level] || '📝'} [${timestamp}] ${message}`);
  if (Object.keys(data).length > 0)
    console.log(`   📋 Details:`, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────
// JOB PERSISTENCE
// ─────────────────────────────────────────────
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

loadJobs();
setInterval(saveJobs, 30000);

// Clean up completed jobs older than 1 hour
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

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function ensureString(value, defaultValue = '') {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(' ');
  if (typeof value === 'object' && value !== null) {
    if (value.ffmpeg_command) return ensureString(value.ffmpeg_command);
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value || defaultValue);
}

function authMiddleware(req, res, next) {
  const apiKey =
    req.headers['x-api-key'] ||
    (req.headers['authorization']?.startsWith('Bearer ')
      ? req.headers['authorization'].substring(7)
      : null);
  if (API_KEY && apiKey !== API_KEY) {
    return res.status(401).json({ detail: 'Invalid authorization key', status: 'FAILED' });
  }
  next();
}

// ─────────────────────────────────────────────
// SMART WORKER SELECTION
// Checks all 6 repos in parallel, picks the first
// one with no active runs. Falls back to round-robin
// if all are busy (so you never get blocked).
// ─────────────────────────────────────────────
async function getNextRepo() {
  try {
    const checks = WORKER_REPOS.map(async (repo) => {
      try {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs?status=in_progress&per_page=1`,
          { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
        );
        if (!res.ok) return { repo, busy: false };
        const data = await res.json();
        const busy = (data.workflow_runs?.length || 0) > 0;
        return { repo, busy };
      } catch {
        return { repo, busy: false };
      }
    });

    const results = await Promise.all(checks);
    const free = results.find(r => !r.busy);
    const chosen = free
      ? free.repo
      : WORKER_REPOS[currentRepoIndex % WORKER_REPOS.length];

    currentRepoIndex++;
    log('WORKER', `Selected worker`, {
      worker: chosen,
      status: free ? 'free' : 'all-busy-fallback'
    });
    return chosen;
  } catch (err) {
    // If availability check itself fails, fall back to round-robin instantly
    const chosen = WORKER_REPOS[currentRepoIndex % WORKER_REPOS.length];
    currentRepoIndex++;
    log('WARN', `Availability check failed, using round-robin`, { worker: chosen });
    return chosen;
  }
}

function validateKeys(input_files, output_files) {
  if (input_files) {
    for (const key of Object.keys(input_files)) {
      if (!key.startsWith('in_'))
        throw new Error(`Input key "${key}" must start with "in_"`);
    }
  }
  if (output_files && output_files !== 'OUTPUT_FOLDER') {
    for (const key of Object.keys(output_files)) {
      if (!key.startsWith('out_'))
        throw new Error(`Output key "${key}" must start with "out_"`);
    }
  }
}

// ─────────────────────────────────────────────
// GITHUB WORKFLOW TRIGGER
// ─────────────────────────────────────────────
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

    // Wait for GitHub to register the run
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Retry up to 5 times to find the run ID
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
      const matchingRun = runsData.workflow_runs?.find(run => {
        const runTime = new Date(run.created_at).getTime();
        return (Date.now() - runTime) < 120000; // within 2 minutes
      });

      if (matchingRun?.id) {
        log('INFO', `Found run ID`, { worker: repo, run_id: matchingRun.id });
        return matchingRun.id;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    log('WARN', `Workflow triggered but run ID not found`);
    return null;

  } catch (error) {
    log('ERROR', `Failed to trigger workflow`, { error: error.message });
    throw error;
  }
}

// ─────────────────────────────────────────────
// STATUS + LOG HELPERS
// ─────────────────────────────────────────────
async function checkRunStatus(repo, runId) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}`,
      { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } }
    );
    if (!response.ok) return null;
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

function buildOutputFiles(jobOutputFiles) {
  const outputFiles = {};
  if (jobOutputFiles && typeof jobOutputFiles === 'object') {
    for (const [key, filename] of Object.entries(jobOutputFiles)) {
      const url = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${filename}`;
      outputFiles[key] = {
        storage_url: url,
        url,
        file_id: uuidv4(),
        status: 'STORED',
        file_type: 'video',
        mime_type: 'video/mp4'
      };
    }
  }
  return outputFiles;
}

// ─────────────────────────────────────────────
// BACKGROUND STATUS CHECKER (every 20 seconds)
// Faster than original 30s — catches completions quicker
// ─────────────────────────────────────────────
async function checkAllProcessingJobs() {
  const processingJobs = Array.from(jobs.entries())
    .filter(([_, job]) => job.status === 'PROCESSING' && job.run_id);

  // Check all in parallel instead of sequentially
  await Promise.all(processingJobs.map(async ([command_id, job]) => {
    try {
      const runData = await checkRunStatus(job.repo, job.run_id);
      if (!runData || runData.status !== 'completed') return;

      if (runData.conclusion === 'success') {
        jobs.set(command_id, {
          ...job,
          status: 'SUCCESS',
          output_files: buildOutputFiles(job.output_files),
          completed_at: Date.now()
        });
        log('SUCCESS', `Background: Job completed!`, { command_id });
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
    } catch (error) {
      log('ERROR', `Background check error`, { command_id, error: error.message });
    }
  }));
}

setInterval(checkAllProcessingJobs, 20000);

// ─────────────────────────────────────────────
// ██████████████████████████████████████████████
// API ENDPOINTS
// ██████████████████████████████████████████████
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// POST /v1/render  ← THE MAIN UNIFIED ENDPOINT
//
// This is the single endpoint your n8n Code node
// sends to. It auto-detects ffmpeg vs remotion,
// picks the fastest free worker, and fires.
//
// Body for FFmpeg:
// {
//   engine: 'ffmpeg',                     ← or omit, auto-detected
//   ffmpeg_command: '-i {{in_1}} ... {{out_1}} -y',
//   input_files:  { in_1: 'https://...' },
//   output_files: { out_1: 'output.mp4' },
//   max_command_run_seconds: 300           ← optional
// }
//
// Body for Remotion:
// {
//   engine: 'remotion',                   ← or omit, auto-detected
//   remotion_props_json: '{"title":"Hi"}', ← or pass as object
//   remotion_component_url: 'https://...',  ← optional custom component
//   output_files: { out_1: 'output.mp4' },
//   duration: 5, fps: 30, width: 1080, height: 1920
// }
// ─────────────────────────────────────────────
app.post('/v1/render', authMiddleware, async (req, res) => {
  try {
    const command_id = req.body.command_id || uuidv4();

    // Auto-detect engine from what's in the body
    let engine = req.body.engine || 'auto';
    if (engine === 'auto') {
      engine = (req.body.remotion_component_code ||
                req.body.remotion_component_url ||
                req.body.remotion_props_json)
        ? 'remotion'
        : 'ffmpeg';
    }

    const output_files = req.body.output_files || { out_1: `output_${command_id}.mp4` };
    const metadata = req.body.metadata || {};

    // Pick the fastest free worker repo
    const repo = await getNextRepo();

    const job = {
      command_id,
      status: 'PROCESSING',
      repo,
      run_id: null,
      created_at: Date.now(),
      type: engine.toUpperCase(),
      output_files,
      metadata,
      original_request: req.body
    };
    jobs.set(command_id, job);
    saveJobs();

    let workflowInputs;

    if (engine === 'remotion') {
      // Accept remotion_props_json as either a string or an object
      const propsJson = typeof req.body.remotion_props_json === 'string'
        ? req.body.remotion_props_json
        : JSON.stringify(req.body.remotion_props_json || {});

      workflowInputs = {
        engine: 'remotion',
        remotion_props_json: propsJson,
        remotion_component_code: req.body.remotion_component_code || '',
        remotion_component_url:  req.body.remotion_component_url  || '',
        output_files_json: JSON.stringify(output_files),
        duration:  String(req.body.duration  || '5'),
        fps:       String(req.body.fps       || '30'),
        width:     String(req.body.width     || '1080'),
        height:    String(req.body.height    || '1920'),
        command_id
      };
    } else {
      // FFmpeg
      const ffmpeg_command = ensureString(req.body.ffmpeg_command);
      if (!ffmpeg_command.trim()) {
        return res.status(422).json({
          status: 'FAILED',
          detail: 'ffmpeg_command is required when engine is ffmpeg'
        });
      }
      try { validateKeys(req.body.input_files, output_files); }
      catch (e) {
        return res.status(422).json({ status: 'FAILED', detail: e.message });
      }

      workflowInputs = {
        engine: 'ffmpeg',
        ffmpeg_command,
        input_files_json:          JSON.stringify(req.body.input_files || {}),
        output_files_json:         JSON.stringify(output_files),
        max_command_run_seconds:   String(req.body.max_command_run_seconds || '600'),
        input_compressed_folder:   req.body.input_compressed_folder || '',
        command_id
      };
    }

    const runId = await triggerWorkflow(repo, workflowInputs);
    if (runId) {
      job.run_id = runId;
      jobs.set(command_id, job);
      saveJobs();
    }

    log('SUCCESS', `Job started via /v1/render`, { command_id, engine, worker: repo });
    res.json({ command_id, status: 'PROCESSING', engine, worker: repo, run_id: runId });

  } catch (error) {
    log('ERROR', '/v1/render failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /v1/run-ffmpeg-command
// Kept for full Rendi.dev compatibility.
// Internally calls the same logic as /v1/render.
// ─────────────────────────────────────────────
app.post('/v1/run-ffmpeg-command', authMiddleware, async (req, res) => {
  try {
    let {
      ffmpeg_command, input_files, output_files, command_id,
      max_command_run_seconds, vcpu_count, metadata,
      input_compressed_folder, engine,
      remotion_props_json, remotion_component_url, remotion_component_code,
      duration, fps, width, height
    } = req.body;

    ffmpeg_command            = ensureString(ffmpeg_command);
    command_id                = command_id || uuidv4();
    output_files              = output_files || { out_1: 'output.mp4' };
    input_files               = input_files  || {};
    max_command_run_seconds   = String(max_command_run_seconds || '600');
    engine                    = engine || 'auto';
    metadata                  = metadata || {};
    remotion_props_json       = typeof remotion_props_json === 'string'
                                  ? remotion_props_json
                                  : JSON.stringify(remotion_props_json || {});
    input_compressed_folder   = ensureString(input_compressed_folder, '');
    remotion_component_url    = ensureString(remotion_component_url, '');
    remotion_component_code   = ensureString(remotion_component_code, '');
    duration                  = String(duration || '5');
    fps                       = String(fps     || '30');
    width                     = String(width   || '1080');
    height                    = String(height  || '1920');

    if (engine === 'auto') {
      engine = (remotion_component_url || remotion_component_code || remotion_props_json !== '{}')
        ? 'remotion' : 'ffmpeg';
    }

    log('INFO', 'Request on /v1/run-ffmpeg-command', {
      engine,
      command_id,
      preview: ffmpeg_command.substring(0, 100)
    });

    const repo = await getNextRepo();

    const job = {
      command_id, status: 'PROCESSING', repo, run_id: null,
      created_at: Date.now(),
      type: engine === 'remotion' ? 'REMOTION' : 'FFMPEG',
      output_files, metadata, original_request: req.body
    };
    jobs.set(command_id, job);
    saveJobs();

    let workflowInputs;
    if (engine === 'remotion') {
      workflowInputs = {
        engine: 'remotion',
        remotion_props_json,
        remotion_component_code,
        remotion_component_url,
        output_files_json: JSON.stringify(output_files),
        duration, fps, width, height, command_id
      };
    } else {
      if (!ffmpeg_command.trim()) {
        return res.status(422).json({
          status: 'FAILED',
          detail: [{ loc: ['body', 'ffmpeg_command'], msg: 'ffmpeg_command is required', type: 'missing' }]
        });
      }
      try { validateKeys(input_files, output_files); }
      catch (error) {
        return res.status(422).json({
          status: 'FAILED',
          detail: [{ loc: ['body', 'input_files'], msg: error.message, type: 'value_error' }]
        });
      }
      workflowInputs = {
        engine: 'ffmpeg',
        ffmpeg_command,
        input_files_json: JSON.stringify(input_files),
        output_files_json: JSON.stringify(output_files),
        max_command_run_seconds,
        input_compressed_folder,
        command_id
      };
    }

    const runId = await triggerWorkflow(repo, workflowInputs);
    if (runId) { job.run_id = runId; jobs.set(command_id, job); saveJobs(); }

    log('SUCCESS', `Job started`, { command_id, engine, worker: repo });
    res.json({ command_id, status: 'PROCESSING', worker: repo, run_id: runId });

  } catch (error) {
    log('ERROR', 'Request failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /v1/commands/:command_id
// Poll this after submitting a job.
// ─────────────────────────────────────────────
app.get('/v1/commands/:command_id', authMiddleware, async (req, res) => {
  try {
    const { command_id } = req.params;
    const job = jobs.get(command_id);
    if (!job) {
      return res.status(404).json({ status: 'FAILED', detail: 'Command not found' });
    }

    log('STATUS', `Checking: ${command_id}`, { status: job.status, worker: job.repo });

    const response = {
      command_id,
      status: job.status,
      command_type: job.type === 'REMOTION' ? 'REMOTION_COMMAND' : 'FFMPEG_COMMAND',
      worker: job.repo,
      original_request: job.original_request,
      metadata: job.metadata || {}
    };

    if (job.status === 'SUCCESS') {
      response.output_files = job.output_files || {};
      response.total_processing_seconds =
        ((job.completed_at || Date.now()) - job.created_at) / 1000;
    }

    if (job.status === 'FAILED') {
      response.error_message = job.error_message || 'Processing failed';
      response.error_status  = 'PROCESSING_ERROR';
    }

    res.json(response);
  } catch (error) {
    log('ERROR', 'Status check failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// ─────────────────────────────────────────────
// POST /v1/commands/:command_id/check
// Force-check a specific job right now (don't wait
// for the background checker).
// ─────────────────────────────────────────────
app.post('/v1/commands/:command_id/check', authMiddleware, async (req, res) => {
  try {
    const { command_id } = req.params;
    const job = jobs.get(command_id);
    if (!job) return res.status(404).json({ status: 'FAILED', detail: 'Not found' });
    if (!job.run_id) return res.json({ status: job.status, message: 'No run ID yet' });

    const runData = await checkRunStatus(job.repo, job.run_id);

    if (runData?.status === 'completed') {
      if (runData.conclusion === 'success') {
        job.status       = 'SUCCESS';
        job.completed_at = Date.now();
        job.output_files = buildOutputFiles(job.output_files);
      } else {
        job.status        = 'FAILED';
        job.error_message = `Workflow failed: ${runData.conclusion}`;
        job.completed_at  = Date.now();
      }
      jobs.set(command_id, job);
      saveJobs();
    }

    res.json({
      command_id,
      status:             job.status,
      github_status:      runData?.status,
      github_conclusion:  runData?.conclusion,
      output_files:       job.status === 'SUCCESS' ? job.output_files : undefined
    });
  } catch (error) {
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  const activeJobs = Array.from(jobs.values()).filter(j => j.status === 'PROCESSING').length;
  res.json({
    ok:          true,
    active_jobs: activeJobs,
    total_jobs:  jobs.size,
    workers:     WORKER_REPOS.length
  });
});

// ─────────────────────────────────────────────
// GET /
// ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service:      'FFmpeg API - Video Processing Service',
    version:      '5.0.0',
    engines:      ['ffmpeg', 'remotion'],
    auth_methods: ['x-api-key header', 'Authorization Bearer token'],
    endpoints: [
      'POST /v1/render                  ← main unified endpoint',
      'POST /v1/run-ffmpeg-command      ← Rendi.dev compatible',
      'GET  /v1/commands/:id            ← poll for result',
      'POST /v1/commands/:id/check      ← force-check now',
      'GET  /health'
    ]
  });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👷 Workers: ${WORKER_REPOS.length}`);
  console.log(`👤 User: ${GITHUB_USERNAME}`);
  console.log(`⚡ Unified endpoint: POST /v1/render`);
  console.log(`🔄 Background checker: every 20s (parallel)`);
  console.log(`🔑 Auth: x-api-key OR Authorization Bearer`);
});

export default app;
