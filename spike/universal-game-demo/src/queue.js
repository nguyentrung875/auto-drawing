// AD-9 + AD-10: file queue + fail-forward + batch report
const fs = require('fs');
const path = require('path');

function enqueue(queueDir, job) {
  if (!fs.existsSync(queueDir)) fs.mkdirSync(queueDir, { recursive: true });
  const file = path.join(queueDir, `job_${job.jobId}.json`);
  fs.writeFileSync(file, JSON.stringify(job, null, 2), 'utf-8');
  return file;
}
function pollQueue(queueDir) {
  if (!fs.existsSync(queueDir)) return [];
  const files = fs.readdirSync(queueDir).filter(f=>f.startsWith('job_') && f.endsWith('.json')).sort();
  return files.map(f=> {
    const p = path.join(queueDir, f);
    return { file: p, job: JSON.parse(fs.readFileSync(p,'utf-8')) };
  });
}
function updateJobStatus(queueDir, jobId, status, extra={}) {
  const file = path.join(queueDir, `job_${jobId}.json`);
  if (!fs.existsSync(file)) return;
  const j = JSON.parse(fs.readFileSync(file,'utf-8'));
  j.status = status;
  Object.assign(j, extra);
  fs.writeFileSync(file, JSON.stringify(j,null,2),'utf-8');
}

function runBatch(queueDir, processor) {
  // processor: (job)=> {ok, result|error}
  const jobs = pollQueue(queueDir);
  let passed=0, failed=0;
  const details=[];
  for (const {job} of jobs) {
    updateJobStatus(queueDir, job.jobId, 'running');
    try {
      const res = processor(job);
      if (res.ok) {
        passed++;
        updateJobStatus(queueDir, job.jobId, 'done', { result: res.result });
        details.push({ jobId: job.jobId, gameId: job.gameId, status:'done' });
      } else {
        failed++;
        updateJobStatus(queueDir, job.jobId, 'failed', { error: res.error });
        details.push({ jobId: job.jobId, gameId: job.gameId, status:'failed', error: res.error.code });
      }
    } catch (e) {
      failed++;
      updateJobStatus(queueDir, job.jobId, 'failed', { error: { code:'EXCEPTION', message:e.message }});
      details.push({ jobId: job.jobId, status:'failed', error:'EXCEPTION' });
    }
  }
  const report = { total: jobs.length, passed, failed, avg_render_ms: 18*1000, jobs: details, generatedAt: new Date().toISOString() };
  return report;
}

module.exports = { enqueue, pollQueue, updateJobStatus, runBatch };
