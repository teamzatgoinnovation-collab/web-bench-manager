import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobStageStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export type JobStage = {
  id: string;
  label: string;
  status: JobStageStatus;
  startedAt?: number;
  finishedAt?: number;
};

export type JobMeta = {
  env?: string;
  site?: string;
};

export type Job = {
  id: string;
  kind: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  log: string[];
  stages: JobStage[];
  meta?: JobMeta;
  error?: string;
  result?: unknown;
};

const jobs = new Map<string, Job>();
const MAX_JOBS = 50;
const MAX_LOG_LINES = 5000;

function touch(job: Job) {
  job.updatedAt = Date.now();
}

function trimJobs() {
  if (jobs.size <= MAX_JOBS) return;
  const sorted = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  while (sorted.length > MAX_JOBS) {
    const old = sorted.shift();
    if (old) jobs.delete(old.id);
  }
}

export function createJob(kind: string, meta?: JobMeta): Job {
  const job: Job = {
    id: randomUUID(),
    kind,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    log: [],
    stages: [],
    meta,
  };
  jobs.set(job.id, job);
  trimJobs();
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function setJobMeta(id: string, meta: JobMeta) {
  const job = jobs.get(id);
  if (!job) return;
  job.meta = { ...job.meta, ...meta };
  touch(job);
}

export function appendLog(id: string, line: string) {
  const job = jobs.get(id);
  if (!job) return;
  const lines = line.split("\n");
  for (const l of lines) {
    job.log.push(l);
  }
  if (job.log.length > MAX_LOG_LINES) {
    job.log = job.log.slice(-MAX_LOG_LINES);
  }
  touch(job);
}

export function startStage(id: string, stageId: string, label: string) {
  const job = jobs.get(id);
  if (!job) return;
  const existing = job.stages.find((s) => s.id === stageId);
  if (existing) {
    existing.label = label;
    existing.status = "running";
    existing.startedAt = Date.now();
    existing.finishedAt = undefined;
  } else {
    job.stages.push({
      id: stageId,
      label,
      status: "running",
      startedAt: Date.now(),
    });
  }
  touch(job);
}

export function finishStage(
  id: string,
  stageId: string,
  status: Extract<JobStageStatus, "succeeded" | "failed" | "skipped">,
) {
  const job = jobs.get(id);
  if (!job) return;
  const stage = job.stages.find((s) => s.id === stageId);
  if (!stage) {
    job.stages.push({
      id: stageId,
      label: stageId,
      status,
      finishedAt: Date.now(),
    });
  } else {
    stage.status = status;
    stage.finishedAt = Date.now();
  }
  touch(job);
}

export function setJobStatus(id: string, status: JobStatus, extra?: { error?: string; result?: unknown }) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
  touch(job);
  if (extra?.error !== undefined) job.error = extra.error;
  if (extra?.result !== undefined) job.result = extra.result;
}

export function listRecentJobs(limit = 50): Job[] {
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
