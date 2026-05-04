import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = process.cwd();

const ensureFile = (targetPath, contents) => {
  if (existsSync(targetPath)) {
    return false;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, contents, 'utf8');
  return true;
};

const run = (command, options = {}) => {
  execSync(command, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options
  });
};

const waitForPostgres = () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const status = execSync('docker compose ps postgres --format json', {
        cwd: rootDir,
        stdio: ['ignore', 'pipe', 'ignore']
      })
        .toString()
        .trim();

      if (status) {
        const service = JSON.parse(status);
        if (service?.Health === 'healthy' || service?.State === 'running') {
          return;
        }
      }
    } catch {
      // Keep polling until compose reports the service.
    }

    execSync('sleep 1');
  }

  throw new Error('Postgres did not become healthy in time.');
};

const serverEnvPath = resolve(rootDir, 'server/.env');
const clientEnvPath = resolve(rootDir, 'client/.env');
const serverEnvExamplePath = resolve(rootDir, 'server/.env.example');
const clientEnvExamplePath = resolve(rootDir, 'client/.env.example');

const serverEnvExample = `NODE_ENV=development
PORT=3000
CLIENT_ORIGIN=http://localhost:4200
TRUST_PROXY=1
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/htl_bets
JWT_SECRET=dev-only-super-long-secret-change-me-1234567890
JWT_EXPIRES_IN=7d
ADMIN_EMAILS=
CODE_HASH_SECRET=
AUTH_CODE_TTL_MINUTES=10
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_USER=
MAIL_PASS=
MAIL_FROM=no-reply@minigames.local
MAIL_DEBUG_BCC=
`;

const clientEnvExample = `CLIENT_API_URL=/api
CLIENT_SOCKET_URL=
`;

ensureFile(serverEnvExamplePath, serverEnvExample);
ensureFile(clientEnvExamplePath, clientEnvExample);

const serverEnvCreated = ensureFile(serverEnvPath, readFileSync(serverEnvExamplePath, 'utf8'));
const clientEnvCreated = ensureFile(clientEnvPath, readFileSync(clientEnvExamplePath, 'utf8'));

if (serverEnvCreated) {
  console.log('Created server/.env for local development.');
}

if (clientEnvCreated) {
  console.log('Created client/.env for local development.');
}

try {
  run('docker compose up -d postgres');
  waitForPostgres();
} catch (error) {
  console.error('\nFailed to start local PostgreSQL through Docker Compose.');
  console.error('Make sure Docker Desktop or Docker Engine is running, then retry `npm run dev`.\n');
  throw error;
}

run('npm run prisma:generate --workspace server');
run('npm run prisma:deploy --workspace server');
