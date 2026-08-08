-- M063-only rollback. Restore M015 trigger bindings and preserve all M015 tables.
drop trigger revalidate_import_batch_membership_m063 on accounting.import_batches;

drop trigger a_m015_seal_import_staging_lines on accounting.import_staging_lines;
drop trigger a_m015_seal_import_files on accounting.import_files;
drop trigger a_m015_lock_import_batch_membership on accounting.import_batches;

create trigger a_m015_lock_import_batch_membership
before update of status on accounting.import_batches
for each row execute function accounting.guard_import_membership_seal_m015();

create trigger a_m015_seal_import_files
before insert or update or delete on accounting.import_files
for each row execute function accounting.guard_import_membership_seal_m015();

create trigger a_m015_seal_import_staging_lines
before insert or update or delete on accounting.import_staging_lines
for each row execute function accounting.guard_import_membership_seal_m015();

drop function accounting.revalidate_import_batch_membership_m063();
drop function accounting.guard_import_membership_seal_m063();
