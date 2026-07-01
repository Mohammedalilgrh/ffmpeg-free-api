// ============================================================================
// FFmpeg-Free-API - Free Rendi.dev Alternative
// ============================================================================
// Uses GitHub Actions (10 parallel workers) + Cloudflare R2 for $0/month
// video processing. Supports FFmpeg AND Remotion engines.
// Fully Rendi.dev API compatible.
// ============================================================================

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const app = express();
app.use(express.json({ limit: '50mb' }));

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
const API_KEY = process.env.API_KEY;
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_TASKS || '50');
let activeTasks = 0;

const WORKER_REPOS = [
  'ffmpeg-api', 'ffmpeg-api-2', 'ffmpeg-api-3',
  'ffmpeg-api-4', 'ffmpeg-api-5', 'ffmpeg-api-6'
];

let currentRepoIndex = 0;
let jobs = new Map();

// ─────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const emoji = { INFO: '📘', SUCCESS: '✅', ERROR: '❌', WARN: '⚠️', WORKER: '👷', VIDEO: '🎬', REMOTION: '🎨', FFMPEG: '🎥', UPLOAD: '📤', STATUS: '📊' };
  console.log(`${emoji[level] || '📝'} [${timestamp}] ${message}`);
  if (Object.keys(data).length > 0) console.log(`   📋 Details:`, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────
// JOB PERSISTENCE
// ─────────────────────────────────────────────
function loadJobs() {
  try {
    if (fs.existsSync('jobs-backup.json')) {
      jobs = new Map(JSON.parse(fs.readFileSync('jobs-backup.json', 'utf8')));
      log('INFO', `Loaded ${jobs.size} jobs`);
    }
  } catch (e) { jobs = new Map(); }
}

function saveJobs() {
  try { fs.writeFileSync('jobs-backup.json', JSON.stringify(Array.from(jobs.entries()))); }
  catch (e) { log('ERROR', 'Save failed', { error: e.message }); }
}

loadJobs();
setInterval(saveJobs, 30000);
setInterval(() => {
  const now = Date.now();
  let c = 0;
  for (const [id, job] of jobs) {
    if (now - job.created_at > 3600000 && job.status !== 'PROCESSING') { jobs.delete(id); c++; }
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
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value || defaultValue);
}

function authMiddleware(req, res, next) {
  const apiKey = req.headers['x-api-key'] || (req.headers['authorization']?.startsWith('Bearer ') ? req.headers['authorization'].substring(7) : null);
  if (API_KEY && apiKey !== API_KEY) {
    return res.status(401).json({ detail: 'Invalid authorization key', status: 'FAILED' });
  }
  next();
}

// ─────────────────────────────────────────────
// SMART WORKER SELECTION
// ─────────────────────────────────────────────
async function getNextRepo() {
  const repo = WORKER_REPOS[Math.floor(Math.random() * WORKER_REPOS.length)];
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

// ─────────────────────────────────────────────
// GITHUB WORKFLOW TRIGGER
// ─────────────────────────────────────────────
async function triggerWorkflow(repo, inputs, workflowFile = 'render-video.yml') {
  const url = `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/workflows/${workflowFile}/dispatches`;
  log('VIDEO', `Triggering ${workflowFile} on ${repo}`, { worker: repo });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main', inputs })
    });

    if (response.status !== 204) {
      const errorText = await response.text();
      log('ERROR', `Trigger failed on ${repo}`, { status: response.status, error: errorText.substring(0, 300) });
      throw new Error(`GitHub API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    log('SUCCESS', `Workflow triggered on ${repo}`);
    await new Promise(resolve => setTimeout(resolve, 6000));

    for (let i = 0; i < 5; i++) {
      const runsRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs?per_page=5&event=workflow_dispatch`,
        { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
      if (!runsRes.ok) { await new Promise(resolve => setTimeout(resolve, 2000)); continue; }
      const runsData = await runsRes.json();
      const matchingRun = runsData.workflow_runs?.find(run => (Date.now() - new Date(run.created_at).getTime()) < 120000);
      if (matchingRun?.id) { log('INFO', `Found run ID`, { worker: repo, run_id: matchingRun.id }); return matchingRun.id; }
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
    const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/actions/runs/${runId}`,
      { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
    if (!response.ok) return null;
    const data = await response.json();
    log('STATUS', `Run ${runId}`, { status: data.status, conclusion: data.conclusion, worker: repo });
    return data;
  } catch (error) {
    log('ERROR', `Status check error`, { error: error.message });
    return null;
  }
}

function buildOutputFiles(jobOutputFiles, jobType = 'FFMPEG') {
  const outputFiles = {};
  if (jobOutputFiles && typeof jobOutputFiles === 'object') {
    for (const [key, filename] of Object.entries(jobOutputFiles)) {
      const url = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${filename}`;
      const isTranscript = jobType === 'TRANSCRIBE' || filename.endsWith('.json');
      outputFiles[key] = {
        storage_url: url, url, file_id: uuidv4(), status: 'STORED',
        file_type: isTranscript ? 'json' : 'video',
        mime_type: isTranscript ? 'application/json' : 'video/mp4'
      };
    }
  }
  return outputFiles;
}

// ─────────────────────────────────────────────
// BACKGROUND STATUS CHECKER (every 20 seconds)
// ─────────────────────────────────────────────
async function checkAllProcessingJobs() {
  const processingJobs = Array.from(jobs.entries()).filter(([_, job]) => job.status === 'PROCESSING' && job.run_id);
  await Promise.all(processingJobs.map(async ([command_id, job]) => {
    try {
      const runData = await checkRunStatus(job.repo, job.run_id);
      if (!runData || runData.status !== 'completed') return;

      if (runData.conclusion === 'success') {
        jobs.set(command_id, { ...job, status: 'SUCCESS', output_files: buildOutputFiles(job.output_files, job.type), completed_at: Date.now() });

        // For transcribe/probe jobs, auto-fetch result JSON
        if (job.type === 'TRANSCRIBE' || job.type === 'AUDIO_PROBE') {
          const updatedJob = jobs.get(command_id);
          const resultUrl = updatedJob?.output_files?.out_transcript?.url || updatedJob?.output_files?.out_probe?.url;
          if (resultUrl) {
            try {
              const resp = await fetch(resultUrl);
              if (resp.ok) {
                updatedJob.probe_data = await resp.json();
                jobs.set(command_id, updatedJob);
                log('SUCCESS', `Background: Result fetched for ${command_id}`);
              }
            } catch (_) {}
          }
        }

        log('SUCCESS', `Background: Job completed!`, { command_id });
      } else if (runData.conclusion === 'failure') {
        // Extract error message from job logs
        let errorMsg = `Workflow failed: ${runData.conclusion}`;
        try {
          const jobsRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${job.repo}/actions/runs/${job.run_id}/jobs`,
            { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            for (const actionJob of jobsData.jobs || []) {
              if (actionJob.conclusion === 'failure') {
                for (const step of actionJob.steps || []) {
                  if (step.conclusion === 'failure') {
                    errorMsg = `Failed at step "${step.name}"`;
                    break;
                  }
                }
              }
            }
          }
        } catch (_) {}
        jobs.set(command_id, { ...job, status: 'FAILED', error_message: errorMsg, completed_at: Date.now() });
        log('ERROR', `Background: Job failed`, { command_id, error: errorMsg });
      } else {
        jobs.set(command_id, { ...job, status: 'FAILED', error_message: `Workflow: ${runData.conclusion}`, completed_at: Date.now() });
        log('ERROR', `Background: Job ${runData.conclusion}`, { command_id });
      }
      saveJobs();
    } catch (error) {
      log('ERROR', `Background check error`, { command_id, error: error.message });
    }
  }));
}

setInterval(checkAllProcessingJobs, 60000);

// ─────────────────────────────────────────────
// API ENDPOINTS
// ─────────────────────────────────────────────

// POST /v1/render - Unified endpoint (for n8n code node)
app.post('/v1/render', authMiddleware, async (req, res) => {
  if (activeTasks >= MAX_CONCURRENT) {
    return res.status(429).json({ status: 'FAILED', detail: `Max ${MAX_CONCURRENT} concurrent tasks` });
  }

  try {
    const command_id = req.body.command_id || uuidv4();
    let engine = req.body.engine || 'auto';
    if (engine === 'auto') {
      engine = (req.body.remotion_component_code || req.body.remotion_component_url || req.body.remotion_props_json) ? 'remotion' : 'ffmpeg';
    }

    const output_files = req.body.output_files || { out_1: `output_${command_id}.mp4` };
    const metadata = req.body.metadata || {};
    const repo = await getNextRepo();

    const job = { command_id, status: 'PROCESSING', repo, run_id: null, created_at: Date.now(), type: engine.toUpperCase(), output_files, metadata, original_request: req.body };
    jobs.set(command_id, job);
    saveJobs();
    activeTasks++;

    let workflowInputs;
    if (engine === 'remotion') {
      const propsJson = typeof req.body.remotion_props_json === 'string' ? req.body.remotion_props_json : JSON.stringify(req.body.remotion_props_json || {});
      workflowInputs = {
        remotion_props_json: propsJson,
        remotion_component_code: req.body.remotion_component_code || '',
        remotion_component_url: req.body.remotion_component_url || '',
        output_files_json: JSON.stringify(output_files),
        duration: String(req.body.duration || '5'), fps: String(req.body.fps || '30'),
        width: String(req.body.width || '1080'), height: String(req.body.height || '1920'), command_id
      };
    } else {
      let ffmpeg_command = ensureString(req.body.ffmpeg_command);
      if (!ffmpeg_command.trim()) {
        activeTasks--;
        return res.status(422).json({ status: 'FAILED', detail: 'ffmpeg_command is required' });
      }
      try { validateKeys(req.body.input_files, output_files); }
      catch (e) { activeTasks--; return res.status(422).json({ status: 'FAILED', detail: e.message }); }

      // 🔧 FIX: Ensure ffmpeg prefix is present for the worker workflow
      if (!ffmpeg_command.trim().startsWith('ffmpeg')) {
        ffmpeg_command = 'ffmpeg ' + ffmpeg_command.trim();
      }

      workflowInputs = {
        ffmpeg_command,
        input_files_json: JSON.stringify(req.body.input_files || {}),
        output_files_json: JSON.stringify(output_files),
        max_command_run_seconds: String(req.body.max_command_run_seconds || '600'),
        input_compressed_folder: req.body.input_compressed_folder || '', command_id
      };
    }

    const workflowFile = engine === 'remotion' ? 'render-video.yml' : 'render-video.yml';
    const runId = await triggerWorkflow(repo, workflowInputs, workflowFile);
    if (runId) { job.run_id = runId; jobs.set(command_id, job); saveJobs(); }

    log('SUCCESS', `Job started via /v1/render`, { command_id, engine, worker: repo });
    res.json({ command_id, status: 'PROCESSING', engine, worker: repo, run_id: runId });
  } catch (error) {
    activeTasks--;
    log('ERROR', '/v1/render failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// POST /v1/run-ffmpeg-command (Rendi.dev compatible)
app.post('/v1/run-ffmpeg-command', authMiddleware, async (req, res) => {
  if (activeTasks >= MAX_CONCURRENT) {
    return res.status(429).json({ status: 'FAILED', detail: `Max ${MAX_CONCURRENT} concurrent tasks` });
  }

  try {
    let { ffmpeg_command, input_files, output_files, command_id, max_command_run_seconds, vcpu_count, metadata, input_compressed_folder, engine, remotion_props_json, remotion_component_url, remotion_component_code, duration, fps, width, height } = req.body;

    ffmpeg_command = ensureString(ffmpeg_command);
    command_id = command_id || uuidv4();
    output_files = output_files || { out_1: 'output.mp4' };
    input_files = input_files || {};
    max_command_run_seconds = String(max_command_run_seconds || '600');
    engine = engine || 'auto';
    metadata = metadata || {};
    remotion_props_json = typeof remotion_props_json === 'string' ? remotion_props_json : JSON.stringify(remotion_props_json || {});
    input_compressed_folder = ensureString(input_compressed_folder, '');
    remotion_component_url = ensureString(remotion_component_url, '');
    remotion_component_code = ensureString(remotion_component_code, '');
    duration = String(duration || '5');
    fps = String(fps || '30');
    width = String(width || '1080');
    height = String(height || '1920');

    if (engine === 'auto') {
      engine = (remotion_component_url || remotion_component_code || remotion_props_json !== '{}') ? 'remotion' : 'ffmpeg';
    }

    const repo = await getNextRepo();
    const job = { command_id, status: 'PROCESSING', repo, run_id: null, created_at: Date.now(), type: engine === 'remotion' ? 'REMOTION' : 'FFMPEG', output_files, metadata, original_request: req.body };
    jobs.set(command_id, job);
    saveJobs();
    activeTasks++;

    let workflowInputs;
    if (engine === 'remotion') {
      workflowInputs = { engine: 'remotion', remotion_props_json, remotion_component_code, remotion_component_url, output_files_json: JSON.stringify(output_files), duration, fps, width, height, command_id };
    } else {
      if (!ffmpeg_command.trim()) {
        activeTasks--;
        return res.status(422).json({ status: 'FAILED', detail: [{ loc: ['body', 'ffmpeg_command'], msg: 'ffmpeg_command is required', type: 'missing' }] });
      }
      try { validateKeys(input_files, output_files); }
      catch (error) {
        activeTasks--;
        return res.status(422).json({ status: 'FAILED', detail: [{ loc: ['body', 'input_files'], msg: error.message, type: 'value_error' }] });
      }
      // 🔧 FIX: Ensure ffmpeg prefix is present for the worker workflow
      if (!ffmpeg_command.trim().startsWith('ffmpeg')) {
        ffmpeg_command = 'ffmpeg ' + ffmpeg_command.trim();
      }
      workflowInputs = { ffmpeg_command, input_files_json: JSON.stringify(input_files), output_files_json: JSON.stringify(output_files), max_command_run_seconds, input_compressed_folder, command_id };
    }

    const runId = await triggerWorkflow(repo, workflowInputs, 'render-video.yml');
    if (runId) { job.run_id = runId; jobs.set(command_id, job); saveJobs(); }

    log('SUCCESS', `Job started`, { command_id, engine, worker: repo });
    res.json({ command_id, status: 'PROCESSING', worker: repo, run_id: runId });
  } catch (error) {
    activeTasks--;
    log('ERROR', 'Request failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// GET /v1/commands/:command_id
app.get('/v1/commands/:command_id', authMiddleware, async (req, res) => {
  try {
    const { command_id } = req.params;
    const job = jobs.get(command_id);
    if (!job) return res.status(404).json({ status: 'FAILED', detail: 'Command not found' });

    const response = {
      command_id, status: job.status,
      command_type: job.type === 'REMOTION' ? 'REMOTION_COMMAND'
        : job.type === 'TRANSCRIBE' ? 'TRANSCRIBE'
        : job.type === 'AUDIO_PROBE' ? 'AUDIO_PROBE'
        : 'FFMPEG_COMMAND',
      worker: job.repo, metadata: job.metadata || {}
    };

    if (job.status === 'SUCCESS') {
      response.output_files = job.output_files || {};
      response.total_processing_seconds = ((job.completed_at || Date.now()) - job.created_at) / 1000;
      // For transcribe/probe jobs, include the result JSON directly for convenience
      if (job.type === 'TRANSCRIBE' && job.transcript_data) {
        response.transcript = job.transcript_data;
      }
      if (job.type === 'AUDIO_PROBE' && job.probe_data) {
        response.probe = job.probe_data;
      }
    }

    // ⚠️ IMPORTANT: Always return error info to n8n
    if (job.status === 'FAILED') {
      response.error_message = job.error_message || 'Processing failed. Check GitHub Actions logs for details.';
      response.error_status = 'PROCESSING_ERROR';
    }

    res.json(response);
  } catch (error) {
    log('ERROR', 'Status check failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// POST /v1/commands/:command_id/check (force check)
app.post('/v1/commands/:command_id/check', authMiddleware, async (req, res) => {
  try {
    const { command_id } = req.params;
    const job = jobs.get(command_id);
    if (!job) return res.status(404).json({ status: 'FAILED', detail: 'Not found' });
    if (!job.run_id) return res.json({ status: job.status, message: 'No run ID yet' });

    const runData = await checkRunStatus(job.repo, job.run_id);
    if (runData?.status === 'completed') {
      if (runData.conclusion === 'success') {
        job.status = 'SUCCESS';
        job.completed_at = Date.now();
        job.output_files = buildOutputFiles(job.output_files, job.type);
        // For transcribe/probe jobs, try to fetch result JSON from R2
        if ((job.type === 'TRANSCRIBE' || job.type === 'AUDIO_PROBE') && job.output_files) {
          try {
            const resultUrl = job.output_files.out_transcript?.url || job.output_files.out_probe?.url;
            if (resultUrl) {
              const resp = await fetch(resultUrl);
              if (resp.ok) {
                const data = await resp.json();
                if (job.type === 'TRANSCRIBE') job.transcript_data = data;
                else job.probe_data = data;
              }
            }
          } catch (_) { /* non-critical, URL still available */ }
        }
      } else {
        let errorMsg = `Workflow failed: ${runData.conclusion}`;
        try {
          const jobsRes = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${job.repo}/actions/runs/${job.run_id}/jobs`,
            { headers: { 'Authorization': `token ${GITHUB_TOKEN}` } });
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json();
            for (const actionJob of jobsData.jobs || []) {
              if (actionJob.conclusion === 'failure') {
                for (const step of actionJob.steps || []) {
                  if (step.conclusion === 'failure') errorMsg = `Failed at step "${step.name}"`;
                }
              }
            }
          }
        } catch (_) {}
        job.status = 'FAILED';
        job.error_message = errorMsg;
        job.completed_at = Date.now();
      }
      jobs.set(command_id, job);
      saveJobs();
    }

    res.json({
      command_id, status: job.status,
      github_status: runData?.status, github_conclusion: runData?.conclusion,
      output_files: job.status === 'SUCCESS' ? job.output_files : undefined,
      error_message: job.status === 'FAILED' ? job.error_message : undefined
    });
  } catch (error) {
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// ─────────────────────────────────────────────
// TRANSCRIBE ENDPOINTS (Speech-to-Text + Audio Analysis)
// ─────────────────────────────────────────────

// POST /v1/audio-probe - Lightweight: audio analysis ONLY (no speech-to-text)
// Fast! No Whisper model download. Just FFmpeg probe + silence detection.
// Accepts: audio_url (public URL) OR binary audio in body as base64
// Returns: duration, sample_rate, channels, silence_gaps[], speaking_rate estimate
app.post('/v1/audio-probe', authMiddleware, async (req, res) => {
  if (activeTasks >= MAX_CONCURRENT) {
    return res.status(429).json({ status: 'FAILED', detail: `Max ${MAX_CONCURRENT} concurrent tasks` });
  }

  try {
    const command_id = req.body.command_id || `probe_${uuidv4().substring(0, 12)}`;
    const audio_url = req.body.audio_url || '';
    const audio_base64 = req.body.audio_base64 || '';
    const metadata = req.body.metadata || {};

    if (!audio_url && !audio_base64) {
      return res.status(422).json({ status: 'FAILED', detail: 'Either audio_url or audio_base64 is required' });
    }

    const repo = await getNextRepo();
    const output_filename = `probe_${command_id}.json`;
    const output_files = { out_probe: output_filename };

    const job = {
      command_id, status: 'PROCESSING', repo, run_id: null,
      created_at: Date.now(), type: 'AUDIO_PROBE',
      output_files, metadata,
      original_request: { audio_url }
    };
    jobs.set(command_id, job);
    saveJobs();
    activeTasks++;

    const workflowInputs = {
      audio_url, audio_base64,
      output_files_json: JSON.stringify(output_files), command_id
    };

    const runId = await triggerWorkflow(repo, workflowInputs, 'audio-probe.yml');
    if (runId) { job.run_id = runId; jobs.set(command_id, job); saveJobs(); }

    log('SUCCESS', `Audio probe job started`, { command_id, worker: repo });
    res.json({
      command_id, status: 'PROCESSING', type: 'AUDIO_PROBE',
      worker: repo, run_id: runId,
      message: `Use GET /v1/commands/${command_id} to get results when ready`
    });
  } catch (error) {
    activeTasks--;
    log('ERROR', '/v1/audio-probe failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// POST /v1/transcribe - Speech-to-text + audio analysis
// Accepts: audio_url (public URL) OR binary audio in body as base64
// Returns: job command_id to poll with /v1/commands/:id
// Full result includes: transcript, words[], silence_gaps[], audio_metadata, speaking_rate
app.post('/v1/transcribe', authMiddleware, async (req, res) => {
  if (activeTasks >= MAX_CONCURRENT) {
    return res.status(429).json({ status: 'FAILED', detail: `Max ${MAX_CONCURRENT} concurrent tasks` });
  }

  try {
    const command_id = req.body.command_id || `transcribe_${uuidv4().substring(0, 12)}`;
    const audio_url = req.body.audio_url || '';
    const audio_base64 = req.body.audio_base64 || '';
    const language = req.body.language || 'auto';      // e.g. 'en', 'ar', 'auto'
    const model_size = req.body.model_size || 'tiny';   // 'tiny' fastest, 'base', 'small', 'medium', 'large'
    const word_timestamps = req.body.word_timestamps !== false;  // default true
    const metadata = req.body.metadata || {};

    if (!audio_url && !audio_base64) {
      return res.status(422).json({ status: 'FAILED', detail: 'Either audio_url or audio_base64 is required' });
    }

    const repo = await getNextRepo();

    const output_filename = `transcript_${command_id}.json`;
    const output_files = { out_transcript: output_filename };

    const job = {
      command_id,
      status: 'PROCESSING',
      repo,
      run_id: null,
      created_at: Date.now(),
      type: 'TRANSCRIBE',
      output_files,
      metadata,
      original_request: { audio_url, language, model_size, word_timestamps }
    };
    jobs.set(command_id, job);
    saveJobs();
    activeTasks++;

    const workflowInputs = {
      audio_url,
      audio_base64,
      language,
      model_size,
      word_timestamps: String(!!word_timestamps),
      output_files_json: JSON.stringify(output_files),
      command_id
    };

    const runId = await triggerWorkflow(repo, workflowInputs, 'transcribe-audio.yml');
    if (runId) { job.run_id = runId; jobs.set(command_id, job); saveJobs(); }

    log('SUCCESS', `Transcribe job started`, { command_id, worker: repo, language, model_size });
    res.json({
      command_id,
      status: 'PROCESSING',
      type: 'TRANSCRIBE',
      worker: repo,
      run_id: runId,
      message: `Use GET /v1/commands/${command_id} to get results when ready`
    });
  } catch (error) {
    activeTasks--;
    log('ERROR', '/v1/transcribe failed', { error: error.message });
    res.status(500).json({ status: 'FAILED', detail: error.message });
  }
});

// GET /health
app.get('/health', (req, res) => {
  const activeJobs = Array.from(jobs.values()).filter(j => j.status === 'PROCESSING').length;
  res.json({ ok: true, active_jobs: activeJobs, total_jobs: jobs.size, workers: WORKER_REPOS.length });
});

// GET /
app.get('/', (req, res) => {
  res.json({
    service: 'FFmpeg API - Free Video Processing',
    version: '5.0.0',
    engines: ['ffmpeg', 'remotion'],
    endpoints: [
      'POST /v1/render', 'POST /v1/run-ffmpeg-command',
      'POST /v1/transcribe', 'POST /v1/audio-probe', 'POST /v1/commands/:id/check',
      'GET  /v1/commands/:id', 'GET /health'
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
  console.log(`🎤 Transcribe endpoint: POST /v1/transcribe`);
  console.log(`📊 Audio Probe endpoint: POST /v1/audio-probe`);
  console.log(`🔄 Background checker: every 20s (parallel)`);
  console.log(`🔑 Auth: x-api-key OR Authorization Bearer`);
});

export default app;
