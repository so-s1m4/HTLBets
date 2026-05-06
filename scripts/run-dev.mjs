import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const rootDir = process.cwd();
const pidFilePath = resolve(rootDir, '.dev-server.pid');
const concurrentlyBin = resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'concurrently.cmd' : 'concurrently'
);

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

const readPid = () => {
  if (!existsSync(pidFilePath)) {
    return null;
  }

  const pid = Number.parseInt(readFileSync(pidFilePath, 'utf8').trim(), 10);
  return Number.isInteger(pid) ? pid : null;
};

const isProcessRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const removePidFile = () => {
  if (existsSync(pidFilePath)) {
    unlinkSync(pidFilePath);
  }
};

const findRepoDevProcessIds = () => {
  try {
    const output = execSync('ps -axo pid=,command=', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const firstSpace = line.indexOf(' ');
        const pid = Number.parseInt(line.slice(0, firstSpace), 10);
        const command = line.slice(firstSpace + 1);
        return { pid, command };
      })
      .filter(({ pid, command }) => {
        if (!Number.isInteger(pid) || pid === process.pid) {
          return false;
        }

        if (!command.includes(rootDir)) {
          return false;
        }

        return (
          command.includes('scripts/run-dev.mjs') ||
          command.includes('node_modules/.bin/concurrently') ||
          command.includes('tsx watch src/server.ts') ||
          command.includes('scripts/start-dev-server.mjs') ||
          command.includes('proxy.conf.json')
        );
      })
      .map(({ pid }) => pid);
  } catch {
    return [];
  }
};

const stopOrphanedDevProcesses = async () => {
  const pids = [...new Set(findRepoDevProcessIds())];

  for (const pid of pids) {
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGTERM');
    }
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const alive = pids.filter((pid) => isProcessRunning(pid));

    if (alive.length === 0) {
      return;
    }

    await sleep(100);
  }

  for (const pid of pids) {
    if (isProcessRunning(pid)) {
      process.kill(pid, 'SIGKILL');
    }
  }
};

const stopExistingDevRunner = async () => {
  const existingPid = readPid();

  if (!existingPid || existingPid === process.pid || !isProcessRunning(existingPid)) {
    removePidFile();
    return;
  }

  process.kill(existingPid, 'SIGTERM');

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!isProcessRunning(existingPid)) {
      removePidFile();
      return;
    }

    await sleep(100);
  }

  process.kill(existingPid, 'SIGKILL');
  removePidFile();
};

await stopExistingDevRunner();
await stopOrphanedDevProcesses();

const child = spawn(
  concurrentlyBin,
  [
    '--kill-others-on-fail',
    '-n',
    'server,client',
    '-c',
    'cyan,blue',
    'npm run dev --workspace server',
    'npm run dev --workspace client'
  ],
  {
    cwd: rootDir,
    stdio: 'inherit'
  }
);

if (typeof child.pid === 'number') {
  writeFileSync(pidFilePath, `${child.pid}\n`, 'utf8');
}

const cleanup = () => {
  const currentPid = readPid();

  if (currentPid === child.pid) {
    removePidFile();
  }
};

child.on('exit', (code, signal) => {
  cleanup();

  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child.exitCode === null) {
      child.kill(signal);
    }
  });
}
