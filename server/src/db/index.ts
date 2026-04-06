import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let db: Database.Database;

/**
 * Convert PostgreSQL-style $1, $2 params to SQLite ? params.
 */
function convertParams(sql: string): string {
  return sql.replace(/\$\d+/g, '?');
}

/**
 * Initialize the SQLite database.
 * - Parses DATABASE_URL to extract the file path
 * - Creates the database file if it doesn't exist
 * - Enables WAL mode for better concurrent read performance
 * - Executes the schema SQL to create tables
 */
export async function initializeDatabase(): Promise<void> {
  let dbPath = config.databaseUrl;
  if (dbPath.startsWith('file:')) {
    dbPath = dbPath.slice(5);
  }
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(__dirname, '..', '..', dbPath);
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log(`[DB] SQLite database initialized at ${dbPath}`);
  console.log('[DB] WAL mode enabled, foreign keys enforced');
}

/**
 * Execute a parameterized query (INSERT/UPDATE/DELETE/SELECT).
 * Accepts PostgreSQL-style $1, $2 params — auto-converted to ? for SQLite.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const sql = convertParams(text);
  const stmt = db.prepare(sql);

  const trimmed = sql.trimStart().toUpperCase();
  const isSelect = trimmed.startsWith('SELECT') || trimmed.includes('RETURNING');

  if (isSelect) {
    const rows = stmt.all(...(params || [])) as T[];
    return { rows, rowCount: rows.length };
  } else {
    const result = stmt.run(...(params || []));
    return { rows: [] as T[], rowCount: result.changes };
  }
}

/**
 * Execute a query and return the first row, or undefined.
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | undefined> {
  const sql = convertParams(text);
  const stmt = db.prepare(sql);
  return stmt.get(...(params || [])) as T | undefined;
}

/**
 * Execute a query and return all rows.
 */
export async function queryAll<T = any>(text: string, params?: any[]): Promise<T[]> {
  const sql = convertParams(text);
  const stmt = db.prepare(sql);
  return stmt.all(...(params || [])) as T[];
}

/**
 * Get the database instance. Throws if not initialized.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    db.close();
    console.log('[DB] Database connection closed');
  }
}
