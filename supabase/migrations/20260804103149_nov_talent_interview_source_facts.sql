begin;

-- Read-only snapshot facts from the formal 27-graduate Entry sheet.
-- Only source row references, dates, codes, and hashes are retained; no personal values.
with source_rows(source_row_no, fact_date) as (
  values
    (4,'2026-03-23'::date),(5,'2026-03-23'::date),
    (6,'2026-04-27'::date),(7,'2026-04-27'::date),(8,'2026-04-27'::date),
    (9,'2026-04-27'::date),(10,'2026-04-27'::date),(11,'2026-04-27'::date),
    (12,'2026-05-29'::date),(13,'2026-05-29'::date),(14,'2026-05-29'::date),
    (15,'2026-05-29'::date),(16,'2026-05-29'::date),(17,'2026-05-29'::date),
    (18,'2026-05-29'::date),(19,'2026-05-29'::date),(20,'2026-05-29'::date),
    (21,'2026-05-29'::date),(22,'2026-06-15'::date),(23,'2026-06-15'::date),
    (24,'2026-06-15'::date),(25,'2026-06-15'::date),(26,'2026-06-15'::date),
    (27,'2026-06-15'::date),(28,'2026-06-15'::date),(29,'2026-06-29'::date),
    (30,'2026-06-29'::date),(31,'2026-06-29'::date),(32,'2026-06-29'::date),
    (33,'2026-06-29'::date),(34,'2026-06-29'::date),(35,'2026-06-29'::date),
    (36,'2026-06-29'::date),(37,'2026-06-29'::date),(38,'2026-06-29'::date),
    (39,'2026-06-29'::date),(40,'2026-07-20'::date),(41,'2026-07-20'::date),
    (42,'2026-07-20'::date),(43,'2026-07-20'::date),(44,'2026-07-20'::date),
    (45,'2026-07-20'::date)
)
insert into public.nov_talent_recruitment_source_facts_v1
  (source_type,source_row_no,fact_code,fact_date,source_fingerprint)
select 'ENTRIES_27',source_row_no,'INTERVIEW_COMPLETED',fact_date,
  encode(extensions.digest(concat_ws('|','ENTRIES_27','840168402',source_row_no,'INTERVIEW_COMPLETED',fact_date::text),'sha256'),'hex')
from source_rows
on conflict (source_type,source_row_no,fact_code) do update
set fact_date=excluded.fact_date,source_fingerprint=excluded.source_fingerprint,imported_at=now();

commit;
