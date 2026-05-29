import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'tara_intelligence',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'himani18',
  max: 10,
  idleTimeoutMillis:30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log(' PostgreSQL connected → tara_intelligence');
});

pool.on('error', (err) => {
  console.error(' Unexpected DB client error:', err.message);
});