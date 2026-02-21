import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { env } from "@repo/env/server";

const sql = neon(env.DATABASE_URL);

let schemaInitialized = false;

async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;

  await sql`
    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      context_json TEXT NOT NULL,
      report_json TEXT NOT NULL,
      created_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_assessments_session ON assessments(session_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS session_data (
      session_id TEXT NOT NULL,
      data_type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      PRIMARY KEY (session_id, data_type)
    )
  `;

  schemaInitialized = true;
}

export type SessionDataType =
  | "product_metadata"
  | "sourcing"
  | "trends"
  | "regulation"
  | "impositive"
  | "market";

export async function saveSessionData(
  sessionId: string,
  dataType: SessionDataType,
  data: unknown,
): Promise<void> {
  await ensureSchema();
  const now = Date.now();
  await sql`
    INSERT INTO session_data (session_id, data_type, data_json, created_at)
    VALUES (${sessionId}, ${dataType}, ${JSON.stringify(data)}, ${now})
    ON CONFLICT (session_id, data_type)
    DO UPDATE SET data_json = ${JSON.stringify(data)}, created_at = ${now}
  `;
}

export async function getSessionData(
  sessionId: string,
  dataType: SessionDataType,
): Promise<unknown | null> {
  await ensureSchema();
  const rows = await sql`
    SELECT data_json FROM session_data
    WHERE session_id = ${sessionId} AND data_type = ${dataType}
  `;
  const row = rows[0] as { data_json: string } | undefined;
  return row ? JSON.parse(row.data_json) : null;
}

export async function getAllSessionData(
  sessionId: string,
): Promise<Record<string, unknown>> {
  await ensureSchema();
  const rows = await sql`
    SELECT data_type, data_json FROM session_data
    WHERE session_id = ${sessionId}
  `;
  const result: Record<string, unknown> = {};
  for (const row of rows as Array<{ data_type: string; data_json: string }>) {
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

export async function getAssessmentBySessionId(
  sessionId: string,
): Promise<StoredAssessment | null> {
  await ensureSchema();
  const rows = await sql`
    SELECT id, session_id, context_json, report_json, created_at
    FROM assessments
    WHERE session_id = ${sessionId}
  `;
  const row = rows[0] as StoredAssessment | undefined;
  return row ?? null;
}

export async function saveAssessment(
  sessionId: string,
  contextJson: string,
  reportJson: string,
): Promise<void> {
  await ensureSchema();
  const id = randomUUID();
  const createdAt = Date.now();

  await sql`
    INSERT INTO assessments (id, session_id, context_json, report_json, created_at)
    VALUES (${id}, ${sessionId}, ${contextJson}, ${reportJson}, ${createdAt})
    ON CONFLICT (session_id)
    DO UPDATE SET
      context_json = ${contextJson},
      report_json = ${reportJson},
      created_at = ${createdAt}
  `;
}
