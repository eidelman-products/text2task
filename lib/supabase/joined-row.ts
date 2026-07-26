/**
 * Standard shape of a `clients` embed selected via
 * `.select("*, clients(id, name, contact_name, phone, email, notes, created_at)")`.
 * Reused across every query in this codebase that joins the clients table
 * this way, instead of each call site re-declaring (or casting to `any`)
 * its own copy of the same shape.
 */
export type EmbeddedClientRow = {
  id: string;
  name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string | null;
};

/**
 * Supabase reports an embedded to-one relation (e.g. a task's `clients` or
 * `projects` join) as either a single object or a single-element array,
 * depending on how it infers foreign-key cardinality from an
 * un-parameterized (no Database schema) client. This normalizes either
 * shape to "the one related row, or null" without needing `any`.
 */
export function normalizeEmbeddedRelation<T>(
  value: T | T[] | null | undefined
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
