import { Pool, QueryResult, QueryResultRow } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let pool: Pool;

/**
 * Initialize the PostgreSQL connection pool and run schema migrations.
 */
export async function initializeDatabase(): Promise<void> {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Verify connection
  const client = await pool.connect();
  try {
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    // Read and execute schema
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);

    console.log(`[DB] PostgreSQL connected: ${config.databaseUrl.replace(/:[^:@]*@/, ':***@')}`);
  } finally {
    client.release();
  }
}

/**
 * Execute a parameterized query.
 */
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Execute a query and return the first row, or undefined.
 */
export async function queryOne<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T | undefined> {
  const result = await pool.query<T>(text, params);
  return result.rows[0];
}

/**
 * Execute a query and return all rows.
 */
export async function queryAll<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/**
 * Get the connection pool. Throws if not initialized.
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Close the connection pool gracefully.
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('[DB] Connection pool closed');
  }
}
