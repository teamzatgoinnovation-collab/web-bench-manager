import { runCommand, type RunResult } from "./docker";
import { catalogAppPath, type CatalogApp } from "./catalog";

export type GitStatus = {
  path: string;
  clean: boolean;
  ahead: number;
  behind: number;
  branch: string;
  raw: string;
  dirtySummary: string;
};

export async function gitStatus(app: CatalogApp): Promise<GitStatus> {
  const cwd = catalogAppPath(app);
  const branchRes = await runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  const branch = branchRes.stdout.trim() || "HEAD";

  const porcelain = await runCommand("git", ["status", "--porcelain"], { cwd });
  const clean = porcelain.ok && porcelain.stdout.trim() === "";

  const aheadBehind = await runCommand(
    "git",
    ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    { cwd },
  );
  let behind = 0;
  let ahead = 0;
  if (aheadBehind.ok) {
    const parts = aheadBehind.stdout.trim().split(/\s+/);
    behind = Number(parts[0] || 0);
    ahead = Number(parts[1] || 0);
  } else {
    // no upstream — treat as needing push check via status -sb
    const sb = await runCommand("git", ["status", "-sb"], { cwd });
    const m = sb.stdout.match(/ahead\s+(\d+)/);
    ahead = m ? Number(m[1]) : 0;
  }

  return {
    path: cwd,
    clean,
    ahead: Number.isFinite(ahead) ? ahead : 0,
    behind: Number.isFinite(behind) ? behind : 0,
    branch,
    raw: porcelain.stdout,
    dirtySummary: porcelain.stdout.trim().split("\n").filter(Boolean).slice(0, 20).join("\n"),
  };
}

/** Push existing commits only. Fails if working tree is dirty. */
export async function gitPushIfNeeded(
  app: CatalogApp,
  log: (line: string) => void,
): Promise<RunResult> {
  const cwd = catalogAppPath(app);
  const status = await gitStatus(app);
  log(`[git] ${app.package} @ ${status.path} branch=${status.branch} clean=${status.clean} ahead=${status.ahead}`);

  if (!status.clean) {
    return {
      ok: false,
      code: 1,
      stdout: status.dirtySummary,
      stderr: `Working tree dirty for ${app.package}. Commit locally first, then re-run deploy.`,
      command: `git status ${cwd}`,
    };
  }

  if (status.ahead === 0) {
    log(`[git] ${app.package}: nothing to push`);
    return {
      ok: true,
      code: 0,
      stdout: "Already up to date with remote (nothing to push)",
      stderr: "",
      command: `git push ${cwd}`,
    };
  }

  log(`[git] pushing ${app.package} (${status.ahead} commit(s))…`);
  const push = await runCommand("git", ["push", "-u", "origin", "HEAD"], {
    cwd,
    timeoutMs: 10 * 60_000,
  });
  log(push.stdout || push.stderr);
  return push;
}
