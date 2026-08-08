# PR002 / M063 Import Batch Local Concurrency — Release Gate

Authoring PASS requires M063 number collision zero; M015 changes zero; active global `SHARE` locks zero; exact M063 trigger bindings; deferred membership revalidation; SECURITY INVOKER and forbidden EXECUTE grants zero; CASCADE zero; and no M016 object.

Local PostgreSQL 17 PASS requires the explicit release order `M001–M011 -> M061 -> M012 -> M013 -> M062 -> M014 -> M015 -> M063`, M015 Negative 60/60 regression, different-Batch nonblocking, same-Batch serialization, File/Line conflict integrity, timeout and rollback release, deadlock delta zero, retained M063 lock zero, fixture residue zero, M063-only rollback, full rollback, object residue zero, reapply and identical catalogs.

Commit, Push, PR, Staging apply, M016, data load, downstream connection, Production and Deploy remain unauthorized until separate Owner approval.
