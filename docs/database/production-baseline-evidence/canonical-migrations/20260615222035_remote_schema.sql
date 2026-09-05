SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."set_customer_stories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();

  if new.is_approved = true and old.is_approved = false and new.approved_at is null then
    new.approved_at = now();
  end if;

  if new.is_approved = false then
    new.approved_at = null;
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."set_customer_stories_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_task_resources_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_task_resources_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."billing_subscriptions" (
    "user_id" "uuid" NOT NULL,
    "lemon_subscription_id" "text",
    "lemon_customer_email" "text",
    "status" "text",
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_portal_url" "text",
    "update_payment_method_url" "text",
    "portal_update_subscription_url" "text",
    "provider" "text",
    "provider_subscription_id" "text",
    "provider_customer_id" "text",
    "customer_email" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false NOT NULL,
    "canceled_at" timestamp with time zone,
    "raw_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."billing_subscriptions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "contact_name" "text"
);

ALTER TABLE "public"."clients" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."customer_stories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "role_or_business_type" "text",
    "rating" integer,
    "feedback_text" "text" NOT NULL,
    "public_permission" boolean DEFAULT false NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_stories_display_name_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "display_name")) >= 2) AND ("char_length"("display_name") <= 80))),
    CONSTRAINT "customer_stories_feedback_text_length_check" CHECK ((("char_length"(TRIM(BOTH FROM "feedback_text")) >= 20) AND ("char_length"("feedback_text") <= 1200))),
    CONSTRAINT "customer_stories_rating_check" CHECK ((("rating" IS NULL) OR (("rating" >= 1) AND ("rating" <= 5)))),
    CONSTRAINT "customer_stories_role_length_check" CHECK ((("role_or_business_type" IS NULL) OR ("char_length"("role_or_business_type") <= 120)))
);

ALTER TABLE "public"."customer_stories" OWNER TO "postgres";

COMMENT ON TABLE "public"."customer_stories" IS 'Real user-submitted Text2Task customer stories/feedback. Public landing page may show only approved stories with public_permission=true.';

COMMENT ON COLUMN "public"."customer_stories"."user_id" IS 'Authenticated Supabase user who submitted the feedback. Never trust client-sent user_id in API routes.';

COMMENT ON COLUMN "public"."customer_stories"."display_name" IS 'Public display name chosen by the user, shown only after approval.';

COMMENT ON COLUMN "public"."customer_stories"."role_or_business_type" IS 'Optional public context such as Freelancer, Web designer, Agency owner, Virtual assistant.';

COMMENT ON COLUMN "public"."customer_stories"."rating" IS 'Optional 1-5 rating. May be hidden in UI if the landing section should feel more like stories than star reviews.';

COMMENT ON COLUMN "public"."customer_stories"."feedback_text" IS 'The user-submitted feedback/customer story text.';

COMMENT ON COLUMN "public"."customer_stories"."public_permission" IS 'User permission allowing Text2Task to display this feedback publicly after approval.';

COMMENT ON COLUMN "public"."customer_stories"."is_approved" IS 'Manual owner/admin approval flag. Users cannot approve themselves from the client.';

COMMENT ON COLUMN "public"."customer_stories"."is_featured" IS 'Optional manual flag for prioritizing stories on the landing page.';

COMMENT ON COLUMN "public"."customer_stories"."approved_at" IS 'Timestamp set when a story is approved.';

CREATE TABLE IF NOT EXISTS "public"."gmail_oauth_tokens" (
    "user_id" "uuid" NOT NULL,
    "provider" "text" DEFAULT 'google'::"text" NOT NULL,
    "email" "text",
    "access_token_encrypted" "text" NOT NULL,
    "refresh_token_encrypted" "text",
    "token_type" "text" DEFAULT 'Bearer'::"text",
    "scope" "text",
    "expires_at" timestamp with time zone,
    "last_refreshed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "gmail_oauth_tokens_provider_check" CHECK (("provider" = 'google'::"text"))
);

ALTER TABLE "public"."gmail_oauth_tokens" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."project_timeline_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "event_title" "text" NOT NULL,
    "event_summary" "text",
    "source_update_id" "uuid",
    "source_item_id" "uuid",
    "target_task_id" bigint,
    "target_field" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "actor_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb",
    CONSTRAINT "project_timeline_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['client_update_received'::"text", 'ai_update_analyzed'::"text", 'update_item_accepted'::"text", 'update_item_rejected'::"text", 'update_applied'::"text", 'subtask_added'::"text", 'subtask_updated'::"text", 'deadline_updated'::"text", 'budget_updated'::"text", 'priority_updated'::"text", 'status_updated'::"text", 'client_details_updated'::"text", 'note_added'::"text", 'resource_added'::"text", 'manual_edit'::"text", 'archive'::"text", 'restore'::"text"])))
);

ALTER TABLE "public"."project_timeline_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."project_timeline_events" IS 'Readable project timeline and audit trail events shown inside Project Update History.';

CREATE TABLE IF NOT EXISTS "public"."project_update_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_update_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "target_task_id" bigint,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "target_field" "text",
    "old_value" "jsonb",
    "new_value" "jsonb",
    "confidence" numeric(5,4),
    "status" "text" DEFAULT 'suggested'::"text" NOT NULL,
    "ai_reason" "text",
    "user_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "accepted_by" "uuid",
    "rejected_by" "uuid",
    "applied_by" "uuid",
    CONSTRAINT "project_update_items_confidence_check" CHECK ((("confidence" IS NULL) OR (("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))),
    CONSTRAINT "project_update_items_status_check" CHECK (("status" = ANY (ARRAY['suggested'::"text", 'accepted'::"text", 'rejected'::"text", 'applied'::"text", 'skipped'::"text", 'failed'::"text"]))),
    CONSTRAINT "project_update_items_type_check" CHECK (("type" = ANY (ARRAY['new_subtask'::"text", 'update_subtask'::"text", 'deadline_change'::"text", 'budget_change'::"text", 'priority_change'::"text", 'status_change'::"text", 'client_detail_change'::"text", 'project_note'::"text", 'client_note'::"text", 'duplicate_warning'::"text", 'no_action'::"text"])))
);

ALTER TABLE "public"."project_update_items" OWNER TO "postgres";

COMMENT ON TABLE "public"."project_update_items" IS 'Individual AI-suggested update items inside a client update. Stores old/new values, approval state, confidence, and audit timestamps.';

CREATE TABLE IF NOT EXISTS "public"."project_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "source_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "raw_input" "text" NOT NULL,
    "ai_summary" "jsonb",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "reviewed_by" "uuid",
    "applied_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "analyzed_at" timestamp with time zone,
    "reviewed_at" timestamp with time zone,
    "applied_at" timestamp with time zone,
    "ignored_at" timestamp with time zone,
    CONSTRAINT "project_updates_source_type_check" CHECK (("source_type" = ANY (ARRAY['text'::"text", 'image'::"text", 'email'::"text", 'manual'::"text"]))),
    CONSTRAINT "project_updates_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'analyzed'::"text", 'reviewed'::"text", 'applied'::"text", 'ignored'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."project_updates" OWNER TO "postgres";

COMMENT ON TABLE "public"."project_updates" IS 'Client update events connected to existing projects. Stores raw client messages, AI summary, lifecycle status, and review/apply timestamps.';

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid",
    "client_name" "text" DEFAULT ''::"text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text",
    "amount" "text",
    "amount_value" numeric,
    "currency_code" "text",
    "deadline_text" "text",
    "deadline_date" "date",
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'New'::"text" NOT NULL,
    "source" "text",
    "raw_input" "text",
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_name" "text"
);

ALTER TABLE "public"."projects" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."scan_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scan_type" "text" NOT NULL,
    "status" "text" DEFAULT 'queued'::"text" NOT NULL,
    "progress_percent" integer DEFAULT 0 NOT NULL,
    "current_step" "text",
    "processed_messages" integer DEFAULT 0 NOT NULL,
    "total_messages_estimate" integer,
    "result_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_page_token" "text",
    CONSTRAINT "scan_jobs_progress_percent_check" CHECK ((("progress_percent" >= 0) AND ("progress_percent" <= 100))),
    CONSTRAINT "scan_jobs_scan_type_check" CHECK (("scan_type" = ANY (ARRAY['sample'::"text", 'full'::"text"]))),
    CONSTRAINT "scan_jobs_status_check" CHECK (("status" = ANY (ARRAY['queued'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);

ALTER TABLE "public"."scan_jobs" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."scan_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "top_senders" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "promotions_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "smart_views_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "inbox_health_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "raw_summary_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."scan_results" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."scan_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "scan_job_id" "uuid",
    "scan_type" "text" NOT NULL,
    "emails_analyzed" integer DEFAULT 0 NOT NULL,
    "promotions_count" integer DEFAULT 0 NOT NULL,
    "sender_groups_count" integer DEFAULT 0 NOT NULL,
    "inbox_health_score" integer DEFAULT 0 NOT NULL,
    "ready_for_cleanup_count" integer DEFAULT 0 NOT NULL,
    "top_sender_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scan_snapshots_scan_type_check" CHECK (("scan_type" = ANY (ARRAY['sample'::"text", 'full'::"text"])))
);

ALTER TABLE "public"."scan_snapshots" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."task_resources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid",
    "task_id" bigint,
    "resource_type" "text" DEFAULT 'link'::"text" NOT NULL,
    "title" "text",
    "url" "text",
    "storage_path" "text",
    "file_name" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "task_resources_has_content_check" CHECK (((NULLIF(TRIM(BOTH FROM COALESCE("title", ''::"text")), ''::"text") IS NOT NULL) OR (NULLIF(TRIM(BOTH FROM COALESCE("url", ''::"text")), ''::"text") IS NOT NULL) OR (NULLIF(TRIM(BOTH FROM COALESCE("storage_path", ''::"text")), ''::"text") IS NOT NULL) OR (NULLIF(TRIM(BOTH FROM COALESCE("notes", ''::"text")), ''::"text") IS NOT NULL))),
    CONSTRAINT "task_resources_resource_type_check" CHECK (("resource_type" = ANY (ARRAY['link'::"text", 'image'::"text", 'logo'::"text", 'banner'::"text", 'document'::"text", 'brief'::"text", 'reference'::"text", 'file'::"text", 'note'::"text", 'website'::"text"]))),
    CONSTRAINT "task_resources_type_check" CHECK (("resource_type" = ANY (ARRAY['website'::"text", 'logo'::"text", 'image'::"text", 'banner'::"text", 'reference'::"text", 'file'::"text", 'note'::"text", 'link'::"text"])))
);

ALTER TABLE "public"."task_resources" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_name" "text" DEFAULT ''::"text" NOT NULL,
    "task_title" "text" DEFAULT ''::"text" NOT NULL,
    "amount" "text" DEFAULT ''::"text",
    "deadline_text" "text" DEFAULT ''::"text" NOT NULL,
    "priority" "text" DEFAULT 'Medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'New'::"text" NOT NULL,
    "source" "text" DEFAULT 'Pasted text'::"text" NOT NULL,
    "raw_input" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deadline_date" timestamp with time zone,
    "amount_value" numeric,
    "currency_code" "text",
    "client_id" "uuid",
    "is_archived" boolean DEFAULT false NOT NULL,
    "archived_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "project_id" "uuid",
    "subtask_order" integer,
    "contact_name" "text"
);

ALTER TABLE "public"."tasks" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."tasks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."tasks_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."tasks_id_seq" OWNED BY "public"."tasks"."id";

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "weekly_cleanup_used" integer DEFAULT 0 NOT NULL,
    "weekly_reset_date" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "weekly_unread_used" integer DEFAULT 0,
    "weekly_unread_reset_date" timestamp with time zone,
    "extract_count" integer DEFAULT 0,
    "pro_started_at" timestamp with time zone,
    "pro_current_period_end" timestamp with time zone,
    "subscription_status" "text" DEFAULT 'free'::"text",
    "creem_customer_id" "text",
    "creem_subscription_id" "text",
    "cancel_at_period_end" boolean DEFAULT false,
    "billing_updated_at" timestamp with time zone
);

ALTER TABLE "public"."users" OWNER TO "postgres";

ALTER TABLE ONLY "public"."tasks" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."tasks_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."customer_stories"
    ADD CONSTRAINT "customer_stories_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."gmail_oauth_tokens"
    ADD CONSTRAINT "gmail_oauth_tokens_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."scan_jobs"
    ADD CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."scan_results"
    ADD CONSTRAINT "scan_results_job_id_key" UNIQUE ("job_id");

ALTER TABLE ONLY "public"."scan_results"
    ADD CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."scan_snapshots"
    ADD CONSTRAINT "scan_snapshots_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."task_resources"
    ADD CONSTRAINT "task_resources_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

CREATE INDEX "billing_subscriptions_customer_email_idx" ON "public"."billing_subscriptions" USING "btree" ("customer_email");

CREATE INDEX "billing_subscriptions_lemon_subscription_id_idx" ON "public"."billing_subscriptions" USING "btree" ("lemon_subscription_id");

CREATE INDEX "billing_subscriptions_provider_customer_id_idx" ON "public"."billing_subscriptions" USING "btree" ("provider_customer_id");

CREATE INDEX "billing_subscriptions_provider_idx" ON "public"."billing_subscriptions" USING "btree" ("provider");

CREATE INDEX "billing_subscriptions_provider_subscription_id_idx" ON "public"."billing_subscriptions" USING "btree" ("provider_subscription_id");

CREATE INDEX "billing_subscriptions_status_idx" ON "public"."billing_subscriptions" USING "btree" ("status");

CREATE INDEX "billing_subscriptions_user_id_idx" ON "public"."billing_subscriptions" USING "btree" ("user_id");

CREATE INDEX "customer_stories_approved_at_idx" ON "public"."customer_stories" USING "btree" ("approved_at" DESC) WHERE ("is_approved" = true);

CREATE INDEX "customer_stories_created_at_idx" ON "public"."customer_stories" USING "btree" ("created_at" DESC);

CREATE INDEX "customer_stories_public_approved_idx" ON "public"."customer_stories" USING "btree" ("is_approved", "public_permission", "is_featured", "created_at" DESC);

CREATE INDEX "customer_stories_user_id_idx" ON "public"."customer_stories" USING "btree" ("user_id");

CREATE INDEX "gmail_oauth_tokens_expires_at_idx" ON "public"."gmail_oauth_tokens" USING "btree" ("expires_at");

CREATE INDEX "idx_scan_jobs_created_at" ON "public"."scan_jobs" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_scan_jobs_status" ON "public"."scan_jobs" USING "btree" ("status");

CREATE INDEX "idx_scan_jobs_user_id" ON "public"."scan_jobs" USING "btree" ("user_id");

CREATE INDEX "idx_scan_jobs_user_status" ON "public"."scan_jobs" USING "btree" ("user_id", "status");

CREATE INDEX "idx_scan_results_job_id" ON "public"."scan_results" USING "btree" ("job_id");

CREATE INDEX "idx_scan_results_user_id" ON "public"."scan_results" USING "btree" ("user_id");

CREATE INDEX "project_timeline_events_created_at_idx" ON "public"."project_timeline_events" USING "btree" ("created_at" DESC);

CREATE INDEX "project_timeline_events_project_id_idx" ON "public"."project_timeline_events" USING "btree" ("project_id");

CREATE INDEX "project_timeline_events_source_item_id_idx" ON "public"."project_timeline_events" USING "btree" ("source_item_id");

CREATE INDEX "project_timeline_events_source_update_id_idx" ON "public"."project_timeline_events" USING "btree" ("source_update_id");

CREATE INDEX "project_timeline_events_target_task_id_idx" ON "public"."project_timeline_events" USING "btree" ("target_task_id");

CREATE INDEX "project_timeline_events_user_id_idx" ON "public"."project_timeline_events" USING "btree" ("user_id");

CREATE INDEX "project_update_items_created_at_idx" ON "public"."project_update_items" USING "btree" ("created_at" DESC);

CREATE INDEX "project_update_items_project_id_idx" ON "public"."project_update_items" USING "btree" ("project_id");

CREATE INDEX "project_update_items_status_idx" ON "public"."project_update_items" USING "btree" ("status");

CREATE INDEX "project_update_items_target_task_id_idx" ON "public"."project_update_items" USING "btree" ("target_task_id");

CREATE INDEX "project_update_items_type_idx" ON "public"."project_update_items" USING "btree" ("type");

CREATE INDEX "project_update_items_update_id_idx" ON "public"."project_update_items" USING "btree" ("project_update_id");

CREATE INDEX "project_update_items_user_id_idx" ON "public"."project_update_items" USING "btree" ("user_id");

CREATE INDEX "project_updates_client_id_idx" ON "public"."project_updates" USING "btree" ("client_id");

CREATE INDEX "project_updates_created_at_idx" ON "public"."project_updates" USING "btree" ("created_at" DESC);

CREATE INDEX "project_updates_project_id_idx" ON "public"."project_updates" USING "btree" ("project_id");

CREATE INDEX "project_updates_status_idx" ON "public"."project_updates" USING "btree" ("status");

CREATE INDEX "project_updates_user_id_idx" ON "public"."project_updates" USING "btree" ("user_id");

CREATE INDEX "projects_client_id_idx" ON "public"."projects" USING "btree" ("client_id");

CREATE INDEX "projects_user_active_idx" ON "public"."projects" USING "btree" ("user_id", "is_archived", "deleted_at");

CREATE INDEX "projects_user_id_idx" ON "public"."projects" USING "btree" ("user_id");

CREATE INDEX "scan_snapshots_scan_job_id_idx" ON "public"."scan_snapshots" USING "btree" ("scan_job_id");

CREATE INDEX "scan_snapshots_user_id_created_at_idx" ON "public"."scan_snapshots" USING "btree" ("user_id", "created_at" DESC);

CREATE INDEX "task_resources_created_at_idx" ON "public"."task_resources" USING "btree" ("created_at" DESC);

CREATE INDEX "task_resources_project_id_idx" ON "public"."task_resources" USING "btree" ("project_id");

CREATE INDEX "task_resources_task_id_idx" ON "public"."task_resources" USING "btree" ("task_id");

CREATE INDEX "task_resources_user_id_idx" ON "public"."task_resources" USING "btree" ("user_id");

CREATE INDEX "task_resources_user_project_created_idx" ON "public"."task_resources" USING "btree" ("user_id", "project_id", "created_at" DESC);

CREATE INDEX "tasks_created_at_idx" ON "public"."tasks" USING "btree" ("created_at" DESC);

CREATE INDEX "tasks_project_id_idx" ON "public"."tasks" USING "btree" ("project_id");

CREATE INDEX "tasks_project_order_idx" ON "public"."tasks" USING "btree" ("project_id", "subtask_order");

CREATE INDEX "tasks_status_idx" ON "public"."tasks" USING "btree" ("status");

CREATE INDEX "tasks_user_active_idx" ON "public"."tasks" USING "btree" ("user_id", "is_archived", "deleted_at", "created_at" DESC);

CREATE INDEX "tasks_user_archived_idx" ON "public"."tasks" USING "btree" ("user_id", "archived_at" DESC) WHERE (("is_archived" = true) AND ("deleted_at" IS NULL));

CREATE INDEX "tasks_user_completed_idx" ON "public"."tasks" USING "btree" ("user_id", "completed_at") WHERE ("completed_at" IS NOT NULL);

CREATE INDEX "tasks_user_deleted_idx" ON "public"."tasks" USING "btree" ("user_id", "deleted_at") WHERE ("deleted_at" IS NOT NULL);

CREATE INDEX "tasks_user_id_idx" ON "public"."tasks" USING "btree" ("user_id");

CREATE OR REPLACE TRIGGER "customer_stories_set_updated_at" BEFORE UPDATE ON "public"."customer_stories" FOR EACH ROW EXECUTE FUNCTION "public"."set_customer_stories_updated_at"();

CREATE OR REPLACE TRIGGER "set_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_task_resources_updated_at" BEFORE UPDATE ON "public"."task_resources" FOR EACH ROW EXECUTE FUNCTION "public"."set_task_resources_updated_at"();

CREATE OR REPLACE TRIGGER "set_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_gmail_oauth_tokens_updated_at" BEFORE UPDATE ON "public"."gmail_oauth_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_scan_jobs_updated_at" BEFORE UPDATE ON "public"."scan_jobs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_scan_results_updated_at" BEFORE UPDATE ON "public"."scan_results" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

ALTER TABLE ONLY "public"."billing_subscriptions"
    ADD CONSTRAINT "billing_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."customer_stories"
    ADD CONSTRAINT "customer_stories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."gmail_oauth_tokens"
    ADD CONSTRAINT "gmail_oauth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "public"."project_update_items"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_source_update_id_fkey" FOREIGN KEY ("source_update_id") REFERENCES "public"."project_updates"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_timeline_events"
    ADD CONSTRAINT "project_timeline_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_project_update_id_fkey" FOREIGN KEY ("project_update_id") REFERENCES "public"."project_updates"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_update_items"
    ADD CONSTRAINT "project_update_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."project_updates"
    ADD CONSTRAINT "project_updates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."scan_jobs"
    ADD CONSTRAINT "scan_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."scan_results"
    ADD CONSTRAINT "scan_results_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."scan_results"
    ADD CONSTRAINT "scan_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."scan_snapshots"
    ADD CONSTRAINT "scan_snapshots_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "public"."scan_jobs"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."scan_snapshots"
    ADD CONSTRAINT "scan_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."task_resources"
    ADD CONSTRAINT "task_resources_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."task_resources"
    ADD CONSTRAINT "task_resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."task_resources"
    ADD CONSTRAINT "task_resources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Public can view approved customer stories" ON "public"."customer_stories" FOR SELECT USING ((("public_permission" = true) AND ("is_approved" = true)));

CREATE POLICY "Service role can manage scan snapshots" ON "public"."scan_snapshots" TO "service_role" USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete own gmail tokens" ON "public"."gmail_oauth_tokens" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own project timeline events" ON "public"."project_timeline_events" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own project update items" ON "public"."project_update_items" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own project updates" ON "public"."project_updates" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own unapproved customer stories" ON "public"."customer_stories" FOR DELETE USING ((("auth"."uid"() = "user_id") AND ("is_approved" = false)));

CREATE POLICY "Users can delete their own projects" ON "public"."projects" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own task resources" ON "public"."task_resources" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own customer stories" ON "public"."customer_stories" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND ("is_approved" = false) AND ("is_featured" = false) AND ("approved_at" IS NULL)));

CREATE POLICY "Users can insert own gmail tokens" ON "public"."gmail_oauth_tokens" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own project timeline events" ON "public"."project_timeline_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own project update items" ON "public"."project_update_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own project updates" ON "public"."project_updates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own clients" ON "public"."clients" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own projects" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own row" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));

CREATE POLICY "Users can insert their own scan jobs" ON "public"."scan_jobs" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own scan results" ON "public"."scan_results" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own task resources" ON "public"."task_resources" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own gmail tokens" ON "public"."gmail_oauth_tokens" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own project timeline events" ON "public"."project_timeline_events" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own project update items" ON "public"."project_update_items" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own project updates" ON "public"."project_updates" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own clients" ON "public"."clients" FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own projects" ON "public"."projects" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own row" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can update their own scan jobs" ON "public"."scan_jobs" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own scan results" ON "public"."scan_results" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own task resources" ON "public"."task_resources" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own customer stories" ON "public"."customer_stories" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own gmail tokens" ON "public"."gmail_oauth_tokens" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own project timeline events" ON "public"."project_timeline_events" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own project update items" ON "public"."project_update_items" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own project updates" ON "public"."project_updates" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own clients" ON "public"."clients" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own projects" ON "public"."projects" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own row" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));

CREATE POLICY "Users can view their own scan jobs" ON "public"."scan_jobs" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own scan results" ON "public"."scan_results" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own scan snapshots" ON "public"."scan_snapshots" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own task resources" ON "public"."task_resources" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."billing_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."customer_stories" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."gmail_oauth_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_timeline_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_update_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."project_updates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."scan_jobs" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."scan_results" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."scan_snapshots" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."task_resources" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."set_customer_stories_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_customer_stories_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_customer_stories_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_task_resources_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_task_resources_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_task_resources_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";

GRANT ALL ON TABLE "public"."billing_subscriptions" TO "anon";

GRANT ALL ON TABLE "public"."billing_subscriptions" TO "authenticated";

GRANT ALL ON TABLE "public"."billing_subscriptions" TO "service_role";

GRANT ALL ON TABLE "public"."clients" TO "anon";

GRANT ALL ON TABLE "public"."clients" TO "authenticated";

GRANT ALL ON TABLE "public"."clients" TO "service_role";

GRANT ALL ON TABLE "public"."customer_stories" TO "anon";

GRANT ALL ON TABLE "public"."customer_stories" TO "authenticated";

GRANT ALL ON TABLE "public"."customer_stories" TO "service_role";

GRANT ALL ON TABLE "public"."gmail_oauth_tokens" TO "anon";

GRANT ALL ON TABLE "public"."gmail_oauth_tokens" TO "authenticated";

GRANT ALL ON TABLE "public"."gmail_oauth_tokens" TO "service_role";

GRANT ALL ON TABLE "public"."project_timeline_events" TO "anon";

GRANT ALL ON TABLE "public"."project_timeline_events" TO "authenticated";

GRANT ALL ON TABLE "public"."project_timeline_events" TO "service_role";

GRANT ALL ON TABLE "public"."project_update_items" TO "anon";

GRANT ALL ON TABLE "public"."project_update_items" TO "authenticated";

GRANT ALL ON TABLE "public"."project_update_items" TO "service_role";

GRANT ALL ON TABLE "public"."project_updates" TO "anon";

GRANT ALL ON TABLE "public"."project_updates" TO "authenticated";

GRANT ALL ON TABLE "public"."project_updates" TO "service_role";

GRANT ALL ON TABLE "public"."projects" TO "anon";

GRANT ALL ON TABLE "public"."projects" TO "authenticated";

GRANT ALL ON TABLE "public"."projects" TO "service_role";

GRANT ALL ON TABLE "public"."scan_jobs" TO "anon";

GRANT ALL ON TABLE "public"."scan_jobs" TO "authenticated";

GRANT ALL ON TABLE "public"."scan_jobs" TO "service_role";

GRANT ALL ON TABLE "public"."scan_results" TO "anon";

GRANT ALL ON TABLE "public"."scan_results" TO "authenticated";

GRANT ALL ON TABLE "public"."scan_results" TO "service_role";

GRANT ALL ON TABLE "public"."scan_snapshots" TO "anon";

GRANT ALL ON TABLE "public"."scan_snapshots" TO "authenticated";

GRANT ALL ON TABLE "public"."scan_snapshots" TO "service_role";

GRANT ALL ON TABLE "public"."task_resources" TO "anon";

GRANT ALL ON TABLE "public"."task_resources" TO "authenticated";

GRANT ALL ON TABLE "public"."task_resources" TO "service_role";

GRANT ALL ON TABLE "public"."tasks" TO "anon";

GRANT ALL ON TABLE "public"."tasks" TO "authenticated";

GRANT ALL ON TABLE "public"."tasks" TO "service_role";

GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "anon";

GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "authenticated";

GRANT ALL ON SEQUENCE "public"."tasks_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."users" TO "anon";

GRANT ALL ON TABLE "public"."users" TO "authenticated";

GRANT ALL ON TABLE "public"."users" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";