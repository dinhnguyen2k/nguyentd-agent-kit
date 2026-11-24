import { existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PORT = Number(process.env.AGY_LSP_PORT || 48991);

export async function isDaemonHealthy(port = DEFAULT_PORT, timeoutMs = 450) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal });
    if (!res.ok) return false;
    const body = await res.json().catch(() => null);
    return Boolean(body && body.ok);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function ensureDaemon(port = DEFAULT_PORT, maxWaitMs = 4000) {
  if (await isDaemonHealthy(port, 400)) return true;

  const lockFile = join(HERE, "daemon.json");
  if (existsSync(lockFile)) {
    try {
      const info = JSON.parse(readFileSync(lockFile, "utf8"));
      if (info?.pid && info.port === port) {
        try {
          process.kill(info.pid, 0);
          // Process alive, give it a moment to finish listening
          if (await isDaemonHealthy(port, 600)) return true;
        } catch {
          /* stale lock */
        }
      }
    } catch {
      /* ignore */
    }
  }

  mkdirSync(HERE, { recursive: true });
  const logFd = openSync(join(HERE, "daemon.log"), "a");
  const child = spawn(process.execPath, [join(HERE, "daemon.mjs")], {
    cwd: HERE,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      AGY_LSP_PORT: String(port),
      AGY_LSP_DEFAULT_WORKTREE: process.env.AGY_LSP_DEFAULT_WORKTREE || process.cwd(),
    },
  });
  child.unref();

  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    if (await isDaemonHealthy(port, 350)) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
