import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

const dotenvPathCandidates = [resolve(process.cwd(), '.env.docker'), resolve(process.cwd(), '..', '.env.docker')];
const dotenvPath = dotenvPathCandidates.find((candidate) => existsSync(candidate));

dotenv.config({
  path: dotenvPath
});

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations'
  },
  datasource: {
    url: process.env['DATABASE_URL']
  }
});
