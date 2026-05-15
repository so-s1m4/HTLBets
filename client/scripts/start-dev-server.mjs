import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readSharedDevConfig } from '../../scripts/dev-config.mjs';

const clientDir = dirname(dirname(fileURLToPath(import.meta.url)));
const rootDir = dirname(clientDir);
const { clientPort } = readSharedDevConfig(rootDir);

const ngBin = resolve(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'ng.cmd' : 'ng');

const child = spawn(
  ngBin,
  ['serve', '--proxy-config', 'proxy.conf.json', '--port', `${clientPort}`, '--host', '0.0.0.0'],
  {
    cwd: clientDir,
    stdio: 'inherit',
    env: process.env
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
