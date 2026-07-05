// Postgres implementation of admin default-assessment CRUD (table:
// admin_assessment_defaults, migration 0006). Mirrors the in-memory functions in
// lib/local-admin-store so the two adapters behave identically. Note: unlike the
// local functions these do not write the in-memory audit log.

import { getPostgresPool } from "@/lib/server/postgres";
import { slugify, type AdminAssessmentDefault, type CreateAdminAssessmentInput } from "@/lib/local-admin-store";

const PROTECTED_ASSESSMENT_IDS = new Set(["gemmatch"]);

interface Row {
  id: string;
  name: string;
  kind: AdminAssessmentDefault["kind"];
  scope: string;
  status: AdminAssessmentDefault["status"];
  questions: number | string;
  note: string;
  origin: AdminAssessmentDefault["origin"];
}

function mapRow(row: Row): AdminAssessmentDefault {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    scope: row.scope,
    status: row.status,
    questions: Number(row.questions),
    note: row.note,
    origin: row.origin,
  };
}

export async function listPostgresAdminAssessments(): Promise<AdminAssessmentDefault[]> {
  const r = await getPostgresPool().query<Row>(`select * from admin_assessment_defaults order by created_at desc`);
  return r.rows.map(mapRow);
}

export async function createPostgresAdminAssessment(input: CreateAdminAssessmentInput): Promise<AdminAssessmentDefault> {
  const pool = getPostgresPool();
  const base = slugify(input.name) || `assess-${Date.now().toString(36)}`;
  const exists = await pool.query<{ id: string }>(`select id from admin_assessment_defaults where id = $1`, [base]);
  const id = exists.rows.length ? `${base}-${Date.now().toString(36)}` : base;
  await pool.query(
    `insert into admin_assessment_defaults (id, name, kind, scope, status, questions, note, origin)
     values ($1, $2, $3, $4, $5, $6, $7, 'custom')`,
    [
      id,
      input.name.trim(),
      input.kind,
      input.scope?.trim() || "All plans",
      input.status ?? "Draft",
      Math.max(0, Math.round(input.questions ?? 0)),
      input.note?.trim() || "",
    ],
  );
  const r = await pool.query<Row>(`select * from admin_assessment_defaults where id = $1`, [id]);
  return mapRow(r.rows[0]);
}

export async function updatePostgresAdminAssessment(
  id: string,
  input: Partial<Omit<AdminAssessmentDefault, "id" | "origin">>,
): Promise<AdminAssessmentDefault | undefined> {
  const pool = getPostgresPool();
  const existing = await pool.query<Row>(`select * from admin_assessment_defaults where id = $1`, [id]);
  if (!existing.rows[0]) return undefined;
  const cur = mapRow(existing.rows[0]);
  const next = {
    name: input.name !== undefined ? input.name.trim() : cur.name,
    kind: input.kind ?? cur.kind,
    scope: input.scope !== undefined ? input.scope.trim() || "All plans" : cur.scope,
    status: input.status ?? cur.status,
    questions: input.questions !== undefined ? Math.max(0, Math.round(input.questions)) : cur.questions,
    note: input.note !== undefined ? input.note.trim() : cur.note,
  };
  await pool.query(
    `update admin_assessment_defaults set name = $1, kind = $2, scope = $3, status = $4, questions = $5, note = $6, updated_at = now()
     where id = $7`,
    [next.name, next.kind, next.scope, next.status, next.questions, next.note, id],
  );
  const r = await pool.query<Row>(`select * from admin_assessment_defaults where id = $1`, [id]);
  return mapRow(r.rows[0]);
}

export async function removePostgresAdminAssessment(
  id: string,
): Promise<{ assessment: AdminAssessmentDefault; deleted: true } | undefined> {
  if (PROTECTED_ASSESSMENT_IDS.has(id)) return undefined;
  const pool = getPostgresPool();
  const existing = await pool.query<Row>(`select * from admin_assessment_defaults where id = $1`, [id]);
  if (!existing.rows[0]) return undefined;
  const assessment = mapRow(existing.rows[0]);
  await pool.query(`delete from admin_assessment_defaults where id = $1`, [id]);
  return { assessment, deleted: true };
}
