/**
 * Minimal structural shape of a Supabase/Postgrest query chain, covering
 * only the methods this codebase's duplicate-detection queries actually
 * call. This lets duplicate-detection functions describe precisely what
 * they need from a query builder, for both the real Supabase client and
 * small test fakes, without resorting to `any`.
 *
 * This repository does not generate Supabase `Database` types (no
 * `database.types.ts` exists, and `createClient`/`createServerClient` are
 * called without a schema generic), so a fully-typed row/column contract
 * isn't available yet. The long-term correct fix is to run
 * `supabase gen types typescript` and parameterize the Supabase clients in
 * lib/supabase/admin.ts and lib/supabase/server.ts with the generated
 * `Database` type; until then, this interface intentionally stays narrow
 * and local rather than fabricating schema fields.
 *
 * Callers that hold the real, un-parameterized Supabase client (whose
 * `.eq()` method carries a very deep generic signature once no Database
 * type is supplied) must accept it through an unconstrained generic
 * parameter and narrow to this interface with a single `as` assertion at
 * the point of use, rather than declaring the parameter as
 * SupabaseLikeClient directly: TypeScript's structural-assignability check
 * against the real client's type overflows its type-instantiation depth
 * limit for any interface that both names an `eq` member and is compared
 * directly against that real client type. Narrowing an unconstrained
 * generic is cheap because there is nothing concrete to structurally
 * compare until the assertion itself, which only checks for "possible"
 * overlap rather than full structural equivalence.
 */
export type SupabaseQueryResult<Row> = {
  data: Row[] | null;
  error: unknown;
};

export interface SupabaseFilterBuilderLike<Row> {
  eq(column: string, value: unknown): this;
  is(column: string, value: unknown): this;
  gte(column: string, value: unknown): this;
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): PromiseLike<SupabaseQueryResult<Row>>;
}

export type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string) => SupabaseFilterBuilderLike<unknown>;
  };
};
