import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type Job = {
  id: string;
  kind: string;
  status: JobStatus;
  createdAt: number;
  updatedAt: number;
  log: string[];
  error?: string;
  result?: unknown;
};

const jobs = new Map<string, Job>();
const MAX_JOBS = 50;
const MAX_LOG_LINES = 5000;

function trimJobs() {
  if (jobs.size <= MAX_JOBS) return;
  const sorted = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  while (sorted.length > MAX_JOBS) {
    const old = sorted.shift();
    if (old) jobs.delete(old.id);
  }
}

export function createJob(kind: string): Job {
  const job: Job = {
    id: randomUUID(),
    kind,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    log: [],
  };
  jobs.set(job.id, job);
  trimJobs();
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
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
  job.updatedAt = Date.now();
}

export function setJobStatus(id: string, status: JobStatus, extra?: { error?: string; result?: unknown }) {
  const job = jobs.get(id);
  if (!job) return;
  job.status = status;
  job.updatedAt = Date.now();
  if (extra?.error !== undefined) job.error = extra.error;
  if (extra?.result !== undefined) job.result = extra.result;
}

export function listRecentJobs(limit = 10): Job[] {
  return [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
