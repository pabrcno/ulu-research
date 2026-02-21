import Database from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "opportunity-assessments.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      context_json TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id);

    CREATE TABLE IF NOT EXISTS session_data (
      session_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (session_id, data_type)
    );
  `);

  return db;
}

export type SessionDataType =
  | "product_metadata"
  | "sourcing"
  | "trends"
  | "regulation"
  | "impositive"
  | "market";

export function saveSessionData(
  sessionId: string,
  dataType: SessionDataType,
  data: unknown,
): void {
  const stmt = getDb().prepare(
    "INSERT OR REPLACE INTO session_data (session_id, data_type, data_json, created_at) VALUES (?, ?, ?, ?)",
  );
  stmt.run(sessionId, dataType, JSON.stringify(data), Date.now());
}

export function getSessionData(
  sessionId: string,
  dataType: SessionDataType,
): unknown | null {
  const stmt = getDb().prepare(
    "SELECT data_json FROM session_data WHERE session_id = ? AND data_type = ?",
  );
  const row = stmt.get(sessionId, dataType) as { data_json: string } | undefined;
  return row ? JSON.parse(row.data_json) : null;
}

export function getAllSessionData(
  sessionId: string,
): Record<string, unknown> {
  const stmt = getDb().prepare(
    "SELECT data_type, data_json FROM session_data WHERE session_id = ?",
  );
  const rows = stmt.all(sessionId) as Array<{ data_type: string; data_json: string }>;
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.data_type] = JSON.parse(row.data_json);
  }
  return result;
}

export interface StoredAssessment {
  id: string;
  session_id: string;
  context_json: string;
  report_json: string;
  created_at: number;
}

export function getAssessmentBySessionId(sessionId: string): StoredAssessment | null {
  const stmt = getDb().prepare(
    "SELECT id, session_id, context_json, report_json, created_at FROM assessments WHERE session_id = ?",
  );
  const row = stmt.get(sessionId) as StoredAssessment | undefined;
  return row ?? null;
}

export function saveAssessment(
  sessionId: string,
  contextJson: string,
  reportJson: string,
): void {
  const id = randomUUID();
  const createdAt = Date.now();

  const stmt = getDb().prepare(
    "INSERT OR REPLACE INTO assessments (id, session_id, context_json, report_json, created_at) VALUES (?, ?, ?, ?, ?)",
  );
  stmt.run(id, sessionId, contextJson, reportJson, createdAt);
}
