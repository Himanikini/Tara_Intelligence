import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const passwordOverride = process.env.postgresql_Password || process.env.POSTGRESQL_PASSWORD;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env');
  process.exit(1);
}

let finalConnectionString = connectionString;
let connectionUser = 'unknown';
let connectionHost = 'unknown';

try {
  const url = new URL(connectionString);
  connectionUser = url.username || connectionUser;
  connectionHost = url.hostname || connectionHost;
  if (!url.password && passwordOverride) {
    url.password = passwordOverride;
    finalConnectionString = url.toString();
    console.log('PostgreSQL using password from postgresql_Password override');
  } else if (url.password) {
    console.log('PostgreSQL using password from DATABASE_URL');
  }
} catch (err: any) {
  console.error('Invalid DATABASE_URL format:', err.message || err);
  process.exit(1);
}

console.log(`PostgreSQL connecting as ${connectionUser}@${connectionHost}`);

export const pool = new Pool({
  connectionString: finalConnectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('PostgreSQL connected (src/mastra/db.ts)');
});

pool.on('error', (err) => {
  console.error('Unexpected DB client error:', err.message);
});
