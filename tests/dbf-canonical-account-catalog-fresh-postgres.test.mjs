import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PGlite } from "../tmp/dbf-pglite-fixture/node_modules/@electric-sql/pglite/dist/index.js";

const files=["20260814140109_dbf_business_data_phase1_foundation.sql","20260815090000_dbf_canonical_account_catalog_owner_review.sql"];
const db=new PGlite();
try{
  await db.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  await db.exec(`create schema extensions; create schema accounting;
    create table accounting.account_identities(account_id uuid primary key default gen_random_uuid(),created_by text not null);
    create table accounting.accounts(account_version_id uuid primary key default gen_random_uuid(),account_id uuid not null references accounting.account_identities,
      version_no bigint not null,account_code text not null,account_name text not null,account_type text not null,statement_type text not null,
      account_category text not null,normal_balance text not null,sign_policy text not null,measure_type text,parent_account_id uuid references accounting.account_identities,
      display_order integer not null,effective_from date not null,status text not null,source_version text not null,mapping_contract_version text not null,
      content_digest text not null,recorded_by text not null);
    create table accounting.account_statement_mappings(statement_mapping_version_id uuid primary key default gen_random_uuid(),account_id uuid not null references accounting.account_identities,
      account_version_id uuid not null references accounting.accounts,version_no bigint not null,statement_type text not null,statement_section text not null,
      statement_line text not null,display_order integer not null,aggregation_behavior text not null,contribution_sign smallint not null,effective_from date not null,
      status text not null,mapping_contract_version text not null,content_digest text not null,recorded_by text not null);`);
  for(const file of files) await db.exec(await fs.readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
  const shape=(await db.query(`select
    (select count(*) from dbf_ingest.account_mapping_review_candidates) candidates,
    (select count(*) from dbf_ingest.account_mapping_review_audit) audits,
    (select relrowsecurity and relforcerowsecurity from pg_class where oid='dbf_ingest.account_mapping_review_candidates'::regclass) candidate_rls,
    has_table_privilege('anon','dbf_ingest.account_mapping_review_candidates','select') anon_read,
    has_table_privilege('authenticated','dbf_ingest.account_mapping_review_candidates','insert') authenticated_write,
    has_function_privilege('service_role','public.dbf_account_review_list_v1(uuid,date)','execute') backend_read`)).rows[0];
  assert.equal(Number(shape.candidates),0); assert.equal(Number(shape.audits),0); assert.equal(shape.candidate_rls,true);
  assert.equal(shape.anon_read,false); assert.equal(shape.authenticated_write,false); assert.equal(shape.backend_read,true);
  await db.exec(`insert into dbf_ingest.source_files(id,sha256,byte_size,original_file_name,media_type,source_system,received_by_employee_id)
     values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',repeat('c',64),1,'fixture','text/plain','fixture','11111111-1111-4111-8111-111111111111');
     insert into dbf_ingest.import_batches(id,source_file_id,fact_kind,fiscal_month,source_type,status,created_by_employee_id)
     values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','cccccccc-cccc-4ccc-8ccc-cccccccccccc','pl','2026-06-01','fixture','owner_review','11111111-1111-4111-8111-111111111111');
     insert into dbf_ingest.account_mapping_review_candidates
    (candidate_id,fiscal_month,company_id,statement_type,source_system,source_batch_id,source_account_code,source_account_name,
     selected_corporate_row_count,mapping_version,mapping_digest,effective_from)
    values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','2026-06-01','e4059116-bdb3-4e13-9763-bbc77bdfe062','pl','fixture',
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','YAYOI_PL_R001','fixture',1,'dbf-pilot-202606-account-owner-review-v1',repeat('a',64),'2026-06-01')`);
  await db.query(`select public.dbf_account_review_decide_v1($1,$2,$3,'NEEDS_REVIEW',null,null,null,null,null,null,'NEEDS_OWNER_REVIEW',false,false)`,[
    "11111111-1111-4111-8111-111111111111","22222222-2222-4222-8222-222222222222","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
  assert.equal(Number((await db.query("select count(*) n from dbf_ingest.account_mapping_review_audit")).rows[0].n),1);
  await assert.rejects(()=>db.exec("delete from dbf_ingest.account_mapping_review_audit"),/APPEND_ONLY/);
  assert.equal(Number((await db.query("select count(*) n from public.dbf_pl_detail_facts")).rows[0].n),0);
  console.log("DBF Canonical Account Catalog fresh PostgreSQL-compatible rehearsal: PASS");
}finally{await db.close();}
