process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = process.env['DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/htl_bets_test';
process.env['JWT_SECRET'] =
  process.env['JWT_SECRET'] || 'test-jwt-secret-that-is-long-enough-for-vitest';
process.env['JWT_EXPIRES_IN'] = process.env['JWT_EXPIRES_IN'] || '7d';
process.env['AUTH_CODE_TTL_MINUTES'] = process.env['AUTH_CODE_TTL_MINUTES'] || '10';
