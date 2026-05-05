import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SHARED_ENV_FILENAME = '.env.docker';
export const SHARED_ENV_EXAMPLE_FILENAME = '.env.docker.example';
export const DEFAULT_CLIENT_PORT = 4200;
export const DEFAULT_POSTGRES_PORT = 5432;
export const DEFAULT_SERVER_PORT = 4201;

export const readEnvValue = (contents, key) => {
  const line = contents
    .split('\n')
    .find((entry) => entry.trim().startsWith(`${key}=`));

  if (!line) {
    return '';
  }

  return line.slice(line.indexOf('=') + 1).trim();
};

export const upsertEnvValue = (contents, key, value) => {
  const lines = contents.split(/\r?\n/);
  let updated = false;

  const nextLines = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      updated = true;
      return `${key}=${value}`;
    }

    return line;
  });

  if (!updated) {
    while (nextLines.length > 0 && nextLines.at(-1) === '') {
      nextLines.pop();
    }

    nextLines.push(`${key}=${value}`);
  }

  return `${nextLines.join('\n').replace(/\n*$/, '')}\n`;
};

export const readSharedEnvPath = (rootDir) => resolve(rootDir, SHARED_ENV_FILENAME);

export const readSharedEnvContents = (rootDir) => {
  const sharedEnvPath = readSharedEnvPath(rootDir);
  return existsSync(sharedEnvPath) ? readFileSync(sharedEnvPath, 'utf8') : '';
};

export const parsePublishedPort = (rawValue, key) => {
  const value = rawValue.trim();
  const candidate = value.includes(':') ? value.split(':').at(-1) || '' : value;
  const port = Number.parseInt(candidate, 10);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid ${key} value: ${rawValue || '<empty>'}`);
  }

  return port;
};

export const readSharedDevConfig = (rootDir) => {
  const sharedEnvContents = readSharedEnvContents(rootDir);
  const clientPort = parsePublishedPort(
    readEnvValue(sharedEnvContents, 'DEV_CLIENT_PORT') || `${DEFAULT_CLIENT_PORT}`,
    'DEV_CLIENT_PORT'
  );
  const serverPort = parsePublishedPort(
    readEnvValue(sharedEnvContents, 'DEV_SERVER_PORT') || `${DEFAULT_SERVER_PORT}`,
    'DEV_SERVER_PORT'
  );
  const postgresPort = parsePublishedPort(
    readEnvValue(sharedEnvContents, 'POSTGRES_PUBLISHED_PORT') || `${DEFAULT_POSTGRES_PORT}`,
    'POSTGRES_PUBLISHED_PORT'
  );
  const clientOrigin = readEnvValue(sharedEnvContents, 'CLIENT_ORIGIN') || `http://localhost:${clientPort}`;
  const devTrustProxy = readEnvValue(sharedEnvContents, 'DEV_TRUST_PROXY') || '1';

  return {
    clientPort,
    serverPort,
    postgresPort,
    clientOrigin,
    devTrustProxy,
    sharedEnvContents,
    sharedEnvPath: readSharedEnvPath(rootDir)
  };
};
