-- PR002 / ACF-01 / M012 rollback
-- Fresh non-Production rehearsal or empty unpublished Staging only. Dependent drops are prohibited.

drop trigger guard_import_staging_lines_mutation on accounting.import_staging_lines;
drop trigger guard_import_files_mutation on accounting.import_files;
drop trigger guard_import_batches_mutation on accounting.import_batches;

drop function accounting.guard_import_boundary_mutation();

drop table accounting.import_staging_lines;
drop table accounting.import_files;
drop table accounting.import_batches;

drop schema accounting;
