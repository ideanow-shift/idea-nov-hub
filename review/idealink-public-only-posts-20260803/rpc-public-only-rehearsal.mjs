import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../../../nov-talent-controlled-recovery-fc51aa2-20260719/review/nov-talent-prospective-canonical-operation-20260719/pglite-fixture/node_modules/@electric-sql/pglite/dist/index.js";

const db = new PGlite();
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create table public.stores(id uuid primary key,store_name text not null);
  create table public.employee_store_assignments(id uuid primary key,employee_id uuid not null,store_id uuid not null,is_active boolean not null);
  create table public.idea_link_posts(
    id uuid primary key,request_id text not null unique,created_at timestamptz not null,
    visibility text,category text,receiver_store_id uuid,sender_id uuid,receiver_id uuid,
    status text not null,comment text
  );
  revoke all on public.idea_link_posts from public,anon,authenticated;
  insert into public.stores values('10000000-0000-4000-8000-000000000001','Eligible');
  insert into public.employee_store_assignments
    select gen_random_uuid(),('20000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
      '10000000-0000-4000-8000-000000000001',true from generate_series(1,5) g;
  insert into public.idea_link_posts
    select gen_random_uuid(),'public-current-'||g,statement_timestamp()-interval '1 day','public','助け合う',
      '10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001','active','public body'
    from generate_series(1,6) g;
  insert into public.idea_link_posts
    select gen_random_uuid(),'public-previous-'||g,date_trunc('month',statement_timestamp())-interval '1 day','public','助け合う',
      '10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
      '60000000-0000-4000-8000-000000000001','active','public body'
    from generate_series(1,6) g;
  insert into public.idea_link_posts
    select gen_random_uuid(),'private-current-'||g,statement_timestamp()-interval '1 day','private','助け合う',
      '10000000-0000-4000-8000-000000000001',
      ('70000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,
      ('80000000-0000-4000-8000-'||lpad(g::text,12,'0'))::uuid,'active','legacy private body'
    from generate_series(1,20) g;
  create function public.thanks_coin_appreciation_analytics(text) returns jsonb
    language sql stable security definer set search_path=pg_catalog as 'select ''{}''::jsonb';
  revoke all on function public.thanks_coin_appreciation_analytics(text) from public,anon,authenticated;
  grant execute on function public.thanks_coin_appreciation_analytics(text) to service_role;
`);

const beforePrivate = await db.query(`select id,request_id,created_at,visibility,category,receiver_store_id,sender_id,receiver_id,status,comment from public.idea_link_posts where visibility='private' order by request_id`);
const sql = await readFile(new URL("../../supabase/thanks-coin-analytics-public-only-20260803.sql", import.meta.url), "utf8");
await db.exec(sql);
const result = (await db.query(`select public.thanks_coin_appreciation_analytics('ROLLING_12_MONTHS') as value`)).rows[0].value;
const afterPrivate = await db.query(`select id,request_id,created_at,visibility,category,receiver_store_id,sender_id,receiver_id,status,comment from public.idea_link_posts where visibility='private' order by request_id`);

assert.equal(result.overallPostCount, 12, "overall count excludes all private rows");
assert.equal(result.participatingSenderCount, 1, "sender aggregate excludes private rows");
assert.equal(result.participatingRecipientCount, 1, "recipient aggregate excludes private rows");
assert.equal(result.monthlyTrend.at(-1).trendCategory, "STABLE", "monthly trend excludes private rows");
assert.equal(result.categoryDistribution.find((row) => row.category === "助け合う").activityCategory, "MEDIUM", "category aggregate excludes private rows");
assert.equal(result.organizationDistribution[0].activityCategory, "MEDIUM", "organization aggregate excludes private rows");
assert.equal(result.rawValuesIncluded, false, "raw values remain absent");
assert.deepEqual(afterPrivate.rows, beforePrivate.rows, "legacy private rows remain byte/value equivalent");
assert.equal((await db.query(`select count(*)::integer as count from public.idea_link_posts where visibility='private'`)).rows[0].count, 20, "no private row was deleted");

await db.close();
console.log(JSON.stringify({ result: "PASS_RPC_PUBLIC_ONLY_REHEARSAL", assertions: 9, persistence: false, productionOperations: 0, rawValuesIncluded: false }));
