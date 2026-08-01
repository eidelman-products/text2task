/**
 * App-layer half of the Work Calendar's "enforced twice" relationship
 * integrity requirement. The database-level backstop is the
 * `enforce_calendar_event_relationship_integrity` trigger in
 * supabase/migrations/202607290001_calendar_events.sql -- this module
 * implements the identical rule (a linked project's client always wins) so
 * the API layer can return a clean, typed error before ever attempting a
 * write, rather than relying solely on a database exception. RLS on
 * `calendar_events.user_id` alone cannot express "the linked project/client
 * belongs to this same user" -- that is a cross-table concern this module
 * (and the trigger) exist specifically to close.
 */

type CalendarSingleResult = {
  data: Record<string, unknown> | null;
  error: unknown;
};

interface SingleRowLookupChain extends PromiseLike<CalendarSingleResult> {
  eq(column: string, value: unknown): this;
  single(): PromiseLike<CalendarSingleResult>;
}

type LinkValidationSupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => SingleRowLookupChain;
  };
};

export type CalendarEventLinkValidationResult =
  | {
      ok: true;
      /** The project id to persist, unchanged from input (already validated). */
      projectId: string | null;
      /**
       * The free-text Project name to persist -- always `null` when
       * `projectId` is non-null (a linked project is never paired with a
       * custom name), otherwise passed through as given (already
       * trimmed/blank-normalized by the Zod schema).
       */
      customProjectName: string | null;
      /**
       * The client id to persist -- normalized to the linked project's
       * current `client_id` when a project is provided (even if a
       * different `clientId` was supplied), or the independently-validated
       * `clientId` when no project is linked, or `null` when neither is.
       */
      clientId: string | null;
      /**
       * The free-text Client name to persist -- always `null` when
       * `clientId` is non-null OR when a project is linked (a linked
       * project's client is always derived, never custom), otherwise
       * passed through as given.
       */
      customClientName: string | null;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function validateCalendarEventLinks<Client>({
  supabase,
  userId,
  projectId,
  customProjectName = null,
  clientId,
  customClientName = null,
}: {
  supabase: Client;
  userId: string;
  projectId: string | null;
  customProjectName?: string | null;
  clientId: string | null;
  customClientName?: string | null;
}): Promise<CalendarEventLinkValidationResult> {
  const client = supabase as LinkValidationSupabaseLikeClient;

  if (projectId !== null) {
    const { data, error } = await client
      .from("projects")
      .select("id, client_id, deleted_at")
      .eq("id", projectId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return { ok: false, status: 404, error: "Linked project not found." };
    }

    const project = data as { id: string; client_id: string | null; deleted_at: string | null };

    if (project.deleted_at !== null) {
      return { ok: false, status: 400, error: "Linked project has been deleted." };
    }

    // Locked rule: a linked project's client always wins, regardless of
    // what clientId was supplied alongside it. Mirrors
    // enforce_calendar_event_relationship_integrity in the migration
    // exactly -- both must agree, since the database re-validates this
    // independently on every write either way. A linked project is never
    // paired with either custom name.
    return {
      ok: true,
      projectId: project.id,
      customProjectName: null,
      clientId: project.client_id,
      customClientName: null,
    };
  }

  // No linked project -- customProjectName (if any) passes straight
  // through, and Client remains independently editable (a linked client,
  // a custom name, or neither).
  if (clientId !== null) {
    const { data, error } = await client
      .from("clients")
      .select("id")
      .eq("id", clientId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return { ok: false, status: 404, error: "Linked client not found." };
    }

    const clientRow = data as { id: string };

    return {
      ok: true,
      projectId: null,
      customProjectName,
      clientId: clientRow.id,
      customClientName: null,
    };
  }

  return {
    ok: true,
    projectId: null,
    customProjectName,
    clientId: null,
    customClientName,
  };
}
