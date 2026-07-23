import { describe, expect, it } from "vitest";

import {
  buildDuplicateCandidateFromProjectPayload,
  findDuplicateProject,
  findDuplicateProjectStrict,
} from "./project-duplicate-detection";

/**
 * Minimal fake Supabase query builder. Every chain method returns the
 * builder itself and the builder is thenable, so
 * `await supabase.from(...).select(...).eq(...).is(...).gte(...).order(...).limit(...)`
 * resolves with the configured { data, error } exactly like the real
 * Postgrest client, without needing a live database.
 */
function buildFakeSupabase(rows: unknown[], error: unknown = null) {
  const builder = {
    from() {
      return builder;
    },
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    is() {
      return builder;
    },
    gte() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    then(resolve: (value: { data: unknown; error: unknown }) => void) {
      resolve(error ? { data: null, error } : { data: rows, error: null });
    },
  };

  return builder;
}

const BASE_CANDIDATE_TASKS = [
  { task_title: "Draft engagement letter" },
  { task_title: "File compliance paperwork" },
  { task_title: "Schedule client review" },
  { task_title: "Send closing summary" },
];

function buildExistingTaskRow(
  overrides: Partial<{
    id: number;
    project_id: string | null;
    task_title: string | null;
    amount: string | null;
    deadline_text: string | null;
    deadline_date: string | null;
    created_at: string | null;
    client_name: string | null;
    contact_name: string | null;
    projects: {
      amount?: string | null;
      amount_value?: number | null;
      currency_code?: string | null;
      deadline_text?: string | null;
      deadline_date?: string | null;
    } | null;
  }> = {}
) {
  return {
    id: 1,
    project_id: "project-1",
    task_title: "Draft engagement letter",
    amount: null,
    deadline_text: null,
    deadline_date: null,
    created_at: new Date().toISOString(),
    client_name: "Maple & Harbor Legal QA5",
    contact_name: "Sophia Bennett",
    projects: null,
    ...overrides,
  };
}

function buildMatchingExistingRows(
  projectFields: {
    amount?: string | null;
    amount_value?: number | null;
    currency_code?: string | null;
    deadline_text?: string | null;
    deadline_date?: string | null;
  } | null
) {
  return BASE_CANDIDATE_TASKS.map((task, index) =>
    buildExistingTaskRow({
      id: index + 1,
      task_title: task.task_title,
      // Mirrors the real, confirmed regression: per-task amount/deadline
      // columns are blank (text extraction intentionally leaves them blank
      // when a project-level value already covers the request), while the
      // canonical project-level values live only on the joined project row.
      amount: null,
      deadline_text: null,
      deadline_date: null,
      projects: projectFields,
    })
  );
}

function buildCandidate(overrides: Partial<Parameters<typeof buildDuplicateCandidateFromProjectPayload>[0]> = {}) {
  return buildDuplicateCandidateFromProjectPayload({
    client_name: "Maple & Harbor Legal QA5",
    contact_name: "Sophia Bennett",
    subtasks: BASE_CANDIDATE_TASKS,
    ...overrides,
  });
}

describe("findDuplicateProject - existing project data source", () => {
  it("carries the existing saved amount from the joined projects row, not the blank per-task column", async () => {
    const supabase = buildFakeSupabase(
      buildMatchingExistingRows({
        amount: "1725",
        amount_value: 1725,
        currency_code: "USD",
        deadline_text: null,
        deadline_date: "2026-10-09",
      })
    );

    const match = await findDuplicateProject({
      supabase,
      userId: "user-1",
      candidate: buildCandidate(),
    });

    expect(match).not.toBeNull();
    expect(match?.amount).toBe("1725");
    expect(match?.amount_value).toBe(1725);
  });

  it("carries the existing saved currency from the joined projects row", async () => {
    const supabase = buildFakeSupabase(
      buildMatchingExistingRows({
        amount: "1725",
        amount_value: 1725,
        currency_code: "USD",
        deadline_date: "2026-10-09",
      })
    );

    const match = await findDuplicateProject({
      supabase,
      userId: "user-1",
      candidate: buildCandidate(),
    });

    expect(match?.currency_code).toBe("USD");
  });

  it("carries the existing saved deadline from the joined projects row", async () => {
    const supabase = buildFakeSupabase(
      buildMatchingExistingRows({
        amount: "1725",
        amount_value: 1725,
        currency_code: "USD",
        deadline_date: "2026-10-09",
      })
    );

    const match = await findDuplicateProject({
      supabase,
      userId: "user-1",
      candidate: buildCandidate(),
    });

    expect(match?.deadline_date).toBe("2026-10-09");
  });

  it("uses null/fallback text values when the existing project genuinely has no amount or deadline saved", async () => {
    const supabase = buildFakeSupabase(buildMatchingExistingRows(null));

    const match = await findDuplicateProject({
      supabase,
      userId: "user-1",
      candidate: buildCandidate(),
    });

    expect(match).not.toBeNull();
    expect(match?.amount).toBeNull();
    expect(match?.amount_value).toBeNull();
    expect(match?.currency_code).toBeNull();
    expect(match?.deadline_text).toBeNull();
    expect(match?.deadline_date).toBeNull();
  });

  it("never substitutes the incoming candidate's amount/deadline for a genuinely missing existing value", async () => {
    const supabase = buildFakeSupabase(buildMatchingExistingRows(null));

    const match = await findDuplicateProject({
      supabase,
      userId: "user-1",
      candidate: buildCandidate({
        amount: "999",
        deadline_text: "tomorrow",
        deadline_date: "2026-01-01",
      }),
    });

    expect(match).not.toBeNull();
    expect(match?.amount).not.toBe("999");
    expect(match?.amount).toBeNull();
    expect(match?.deadline_text).not.toBe("tomorrow");
    expect(match?.deadline_date).not.toBe("2026-01-01");
    expect(match?.deadline_date).toBeNull();
  });

  it("resolves without throwing for an expected duplicate result", async () => {
    const supabase = buildFakeSupabase(
      buildMatchingExistingRows({
        amount: "1725",
        amount_value: 1725,
        currency_code: "USD",
        deadline_date: "2026-10-09",
      })
    );

    await expect(
      findDuplicateProject({
        supabase,
        userId: "user-1",
        candidate: buildCandidate(),
      })
    ).resolves.not.toThrow();
  });

  it("fails open (resolves null, does not throw) when the lookup query itself errors", async () => {
    const supabase = buildFakeSupabase([], { message: "boom" });

    await expect(
      findDuplicateProject({
        supabase,
        userId: "user-1",
        candidate: buildCandidate(),
      })
    ).resolves.toBeNull();
  });

  it("findDuplicateProjectStrict throws (fails closed) when the lookup query errors, unlike the non-strict variant", async () => {
    const supabase = buildFakeSupabase([], { message: "boom" });

    await expect(
      findDuplicateProjectStrict({
        supabase,
        userId: "user-1",
        candidate: buildCandidate(),
      })
    ).rejects.toThrow();
  });

  it("text-shaped and image-shaped candidates built from equivalent canonical payload fields produce identical comparison inputs", async () => {
    const textLikePayload = {
      client_name: "Maple & Harbor Legal QA5",
      contact_name: "Sophia Bennett",
      amount: "1725",
      deadline_text: "2026-10-09",
      deadline_date: "2026-10-09",
      subtasks: BASE_CANDIDATE_TASKS,
    };
    const imageLikePayload = {
      client_name: "Maple & Harbor Legal QA5",
      contact_name: "Sophia Bennett",
      amount: "1725",
      deadline_text: "2026-10-09",
      deadline_date: "2026-10-09",
      subtasks: BASE_CANDIDATE_TASKS,
    };

    const textCandidate = buildDuplicateCandidateFromProjectPayload(textLikePayload);
    const imageCandidate = buildDuplicateCandidateFromProjectPayload(imageLikePayload);

    expect(textCandidate).toEqual(imageCandidate);

    const supabase1 = buildFakeSupabase(
      buildMatchingExistingRows({
        amount: "1725",
        amount_value: 1725,
        currency_code: "USD",
        deadline_date: "2026-10-09",
      })
    );
    const supabase2 = buildFakeSupabase(
      buildMatchingExistingRows({
        amount: "1725",
        amount_value: 1725,
        currency_code: "USD",
        deadline_date: "2026-10-09",
      })
    );

    const [textMatch, imageMatch] = await Promise.all([
      findDuplicateProject({
        supabase: supabase1,
        userId: "user-1",
        candidate: textCandidate,
      }),
      findDuplicateProject({
        supabase: supabase2,
        userId: "user-1",
        candidate: imageCandidate,
      }),
    ]);

    expect(textMatch?.score).toBe(imageMatch?.score);
    expect(textMatch?.confidence).toBe(imageMatch?.confidence);
  });
});
