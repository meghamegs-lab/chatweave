import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

let db: Database.Database;

/**
 * Initialize the SQLite database.
 * - Parses DATABASE_URL to extract the file path
 * - Creates the database file if it doesn't exist
 * - Enables WAL mode for better concurrent read performance
 * - Executes the schema SQL to create tables
 */
export function initializeDatabase(): Database.Database {
  // Parse database path from URL (strip "file:" prefix if present)
  let dbPath = config.databaseUrl;
  if (dbPath.startsWith('file:')) {
    dbPath = dbPath.slice(5);
  }

  // Resolve relative paths from the server directory
  if (!path.isAbsolute(dbPath)) {
    dbPath = path.resolve(__dirname, '..', '..', dbPath);
  }

  // Ensure the directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Read and execute schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  console.log(`[DB] SQLite database initialized at ${dbPath}`);
  console.log('[DB] WAL mode enabled, foreign keys enforced');

  return db;
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
export function closeDatabase(): void {
  if (db) {
    db.close();
    console.log('[DB] Database connection closed');
  }
}
