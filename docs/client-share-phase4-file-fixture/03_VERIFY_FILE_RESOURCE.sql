-- Text2Task Client Share Link -- Phase 4 Disposable File Fixture
-- File 03: Verify the inserted FILE resource
--
-- DISPOSABLE TEST PROJECT ONLY
-- PRODUCTION APPLICATION NOT AUTHORIZED
--
-- READ-ONLY. Run after 02_INSERT_FILE_RESOURCE.sql. Never raises on its
-- own (matching this repository's own established preference, per
-- docs/client-share-phase3-browser-acceptance/04_CAPTURE_RESULTS.md's
-- account of File 03's own history there, for a trailing `raise
-- exception` rolling back and hiding results) -- prints one row per
-- check plus a final summary instead.

with expected as (
  select
    '66666666-6666-4666-8666-666666666666'::uuid as resource_id,
    '33333333-3333-4333-8333-333333333333'::uuid as project_id,
    'phase3-browser-owner@example.invalid'::text as owner_email
),
resolved_owner as (
  select id as owner_id from auth.users, expected where email = expected.owner_email
),
row_under_test as (
  select tr.*
  from public.task_resources tr, expected
  where tr.id = expected.resource_id
),
checks as (
  select 'A1_row_exists' as check_id,
         exists(select 1 from row_under_test) as passed,
         'task_resources row with the fixture resource id exists' as description
  union all
  select 'A2_correct_owner',
         (select user_id from row_under_test) = (select owner_id from resolved_owner),
         'row.user_id matches the resolved disposable owner id'
  union all
  select 'A3_correct_project',
         (select project_id from row_under_test) = (select project_id from expected),
         'row.project_id matches the Phase 3 fixture project id'
  union all
  select 'A4_task_id_null',
         (select task_id from row_under_test) is null,
         'row.task_id is null (project-level resource, by design)'
  union all
  select 'A5_resource_type_file',
         (select resource_type from row_under_test) = 'file',
         'row.resource_type is exactly ''file'''
  union all
  select 'A6_url_null',
         (select url from row_under_test) is null,
         'row.url is null (never classifies as a LINK resource)'
  union all
  select 'A7_storage_path_shape',
         (select storage_path from row_under_test) ~
           ('^' || (select owner_id::text from resolved_owner) || '/' ||
            (select project_id::text from expected) || '/project/[0-9a-f-]{36}\.txt$'),
         'row.storage_path matches <owner_id>/<project_id>/project/<uuid>.txt exactly'
  union all
  select 'A8_file_classification',
         -- Mirrors resource-api.ts's own isFileResource: storage_path OR
         -- file_name truthy, checked here in the same not-a-note,
         -- file-before-link precedence classifyResource itself uses.
         (select resource_type from row_under_test) is distinct from 'note'
           and coalesce((select storage_path from row_under_test), (select file_name from row_under_test)) is not null,
         'classifies as FILE under the app''s own isFileResource/isNoteResource precedence'
  union all
  select 'A9_size_bytes',
         (select size_bytes from row_under_test) = 9961472,
         'row.size_bytes is exactly 9,961,472 (9.5 * 1024 * 1024)'
  union all
  select 'A10_mime_type_allowed',
         (select mime_type from row_under_test) = 'text/plain',
         'row.mime_type (text/plain) is in the real upload MIME allowlist'
)
-- Single result set: the ten itemized checks followed by one summary
-- row (check_id 'Z_SUMMARY') -- deliberately ONE statement, not two,
-- since a `with` CTE's scope does not extend across a `;` statement
-- boundary in a SQL Editor that runs each statement separately.
select check_id, case when passed then 'PASS' else 'FAIL' end as result, description
from checks
union all
select
  'Z_SUMMARY',
  format('%s/%s PASS', count(*) filter (where passed), count(*)),
  case when count(*) filter (where not passed) = 0
       then 'FILE_FIXTURE_VERIFIED'
       else 'FILE_FIXTURE_VERIFICATION_FAILED'
  end
from checks
order by check_id;

-- Confirm all ten A1-A10 rows read PASS and the final Z_SUMMARY row
-- reads FILE_FIXTURE_VERIFIED before proceeding to the manual browser
-- proof (00_READ_ME_FIRST.md, step 7).
