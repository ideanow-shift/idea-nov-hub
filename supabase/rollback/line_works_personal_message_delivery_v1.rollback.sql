-- Emergency disable/rollback. Run only under separately reviewed rollback procedure.
begin;
revoke all on function os.claim_line_works_personal_message_v1(uuid, uuid, uuid, text, text, timestamptz) from service_role, public, anon, authenticated;
revoke all on function os.begin_line_works_personal_message_delivery_v1(uuid) from service_role, public, anon, authenticated;
revoke all on function os.finish_line_works_personal_message_delivery_v1(uuid, text, text, text) from service_role, public, anon, authenticated;
drop function if exists os.finish_line_works_personal_message_delivery_v1(uuid, text, text, text);
drop function if exists os.begin_line_works_personal_message_delivery_v1(uuid);
drop function if exists os.claim_line_works_personal_message_v1(uuid, uuid, uuid, text, text, timestamptz);
-- Audit rows are intentionally retained. Drop the table only after retention review.
commit;
