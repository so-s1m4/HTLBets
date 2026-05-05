import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import dotenv from 'dotenv';

const rootDir = process.cwd();
const envFile = join(rootDir, '..', '.env.docker');

if (existsSync(envFile)) {
  dotenv.config({ path: envFile });
}

const currentConfigPath = join(rootDir, 'public', 'app-config.js');
const currentFile = existsSync(currentConfigPath) ? readFileSync(currentConfigPath, 'utf8') : '';

const apiUrl = process.env.CLIENT_API_URL || '/api';
const socketUrl = process.env.CLIENT_SOCKET_URL || '';

const nextFile = `window.__HTLBETS_CONFIG__ = ${JSON.stringify(
  {
    apiUrl,
    socketUrl
  },
  null,
  2
)};\n`;

if (currentFile !== nextFile) {
  writeFileSync(currentConfigPath, nextFile, 'utf8');
}
