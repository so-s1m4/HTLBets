import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import net from 'node:net';

import {
  readEnvValue,
  readSharedEnvContents,
  readSharedDevConfig,
  readSharedEnvPath,
  SHARED_ENV_EXAMPLE_FILENAME,
  upsertEnvValue
} from './dev-config.mjs';

const rootDir = process.cwd();
const prismaBin = resolve(rootDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');

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

const parseDatabaseUrl = (databaseUrl) => {
  try {
    return new URL(databaseUrl);
  } catch {
    return null;
  }
};

const canUseComposePostgres = (databaseUrl) => {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    return true;
  }

  const host = parsed.hostname;
  return host === 'localhost' || host === '127.0.0.1';
};

const isComposePostgresRunning = () => {
  try {
    const status = execSync('docker compose ps postgres --format json', {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();

    if (!status) {
      return false;
    }

    const service = JSON.parse(status);
    return service?.State === 'running';
  } catch {
    return false;
  }
};

const isPortReachable = (host, port) =>
  new Promise((resolvePort) => {
    const socket = net.createConnection({ host, port });

    socket.setTimeout(1000);

    socket.on('connect', () => {
      socket.destroy();
      resolvePort(true);
    });

    const onFailure = () => {
      socket.destroy();
      resolvePort(false);
    };

    socket.on('error', onFailure);
    socket.on('timeout', onFailure);
  });

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

const readCommandOutput = (command) => {
  try {
    return execSync(command, {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
  } catch {
    return '';
  }
};

const stopRepoProcessOnPort = (port) => {
  const output = readCommandOutput(`lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp`);
  const pids = output
    .split('\n')
    .filter((line) => line.startsWith('p'))
    .map((line) => Number.parseInt(line.slice(1), 10))
    .filter(Number.isInteger);

  for (const pid of pids) {
    const command = readCommandOutput(`ps -p ${pid} -o command=`);

    if (!command) {
      continue;
    }

    const isRepoOwned =
      command.includes(rootDir) ||
      command.includes('proxy.conf.json') ||
      command.includes('tsx watch src/server.ts') ||
      command.includes('concurrently');

    if (!isRepoOwned) {
      throw new Error(`Port ${port} is already in use by an external process: ${command}`);
    }

    process.kill(pid, 'SIGTERM');
  }
};

const sharedEnvPath = readSharedEnvPath(rootDir);
const sharedEnvExamplePath = resolve(rootDir, SHARED_ENV_EXAMPLE_FILENAME);
const proxyConfigPath = resolve(rootDir, 'client/proxy.conf.json');

ensureFile(sharedEnvPath, readFileSync(sharedEnvExamplePath, 'utf8'));

let sharedEnvContents = readSharedEnvContents(rootDir);
const { clientPort, serverPort, postgresPort, clientOrigin, devTrustProxy } = readSharedDevConfig(rootDir);
const postgresDb = readEnvValue(sharedEnvContents, 'POSTGRES_DB') || 'htl_bets';
const postgresUser = readEnvValue(sharedEnvContents, 'POSTGRES_USER') || 'postgres';
const postgresPassword = readEnvValue(sharedEnvContents, 'POSTGRES_PASSWORD') || 'postgres';
const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@localhost:${postgresPort}/${postgresDb}`;

sharedEnvContents = upsertEnvValue(sharedEnvContents, 'DEV_CLIENT_PORT', `${clientPort}`);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'DEV_SERVER_PORT', `${serverPort}`);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'POSTGRES_PUBLISHED_PORT', readEnvValue(sharedEnvContents, 'POSTGRES_PUBLISHED_PORT') || `${postgresPort}`);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'DEV_TRUST_PROXY', devTrustProxy);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'NODE_ENV', readEnvValue(sharedEnvContents, 'NODE_ENV') || 'development');
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'PORT', `${serverPort}`);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'CLIENT_ORIGIN', clientOrigin);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'DATABASE_URL', databaseUrl);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'TRUST_PROXY', devTrustProxy);
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'CLIENT_API_URL', readEnvValue(sharedEnvContents, 'CLIENT_API_URL') || '/api');
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'CLIENT_SOCKET_URL', readEnvValue(sharedEnvContents, 'CLIENT_SOCKET_URL'));
sharedEnvContents = upsertEnvValue(sharedEnvContents, 'DEBUG_AUTH', readEnvValue(sharedEnvContents, 'DEBUG_AUTH') || 'false');
writeFileSync(sharedEnvPath, sharedEnvContents, 'utf8');

const proxyConfig = `${JSON.stringify(
  {
    '/api': {
      target: `http://localhost:${serverPort}`,
      secure: false,
      changeOrigin: true
    },
    '/socket.io': {
      target: `http://localhost:${serverPort}`,
      secure: false,
      changeOrigin: true,
      ws: true
    }
  },
  null,
  2
)}\n`;

writeFileSync(proxyConfigPath, proxyConfig, 'utf8');
stopRepoProcessOnPort(clientPort);
stopRepoProcessOnPort(serverPort);

if (canUseComposePostgres(databaseUrl)) {
  const parsed = parseDatabaseUrl(databaseUrl);
  const host = parsed?.hostname ?? 'localhost';
  const port = Number(parsed?.port || 5432);
  const targetPortReachable = await isPortReachable(host, port);

  if (!isComposePostgresRunning() && targetPortReachable) {
    console.log(`Detected an existing PostgreSQL instance at ${host}:${port}. Using it for local development.`);
  } else {
    try {
      run('docker compose --env-file .env.docker up -d postgres');
      waitForPostgres();
    } catch (error) {
      console.error('\nFailed to start local PostgreSQL through Docker Compose.');
      console.error('Make sure Docker Desktop or Docker Engine is running, then retry `npm run dev`.\n');
      throw error;
    }
  }
} else {
  console.log(`Using external PostgreSQL from DATABASE_URL: ${databaseUrl}`);
}

run(`${prismaBin} generate --schema server/prisma/schema.prisma --config server/prisma.config.ts`);
run(`${prismaBin} migrate deploy --schema server/prisma/schema.prisma --config server/prisma.config.ts`);
