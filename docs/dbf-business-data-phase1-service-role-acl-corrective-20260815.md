# DBF Phase B service_role Fact ACL corrective

This forward-only corrective is limited to the five Phase B canonical Fact
tables. Supabase's public-schema default ACL gave `service_role` table
privileges beyond the DBF contract when the tables were created. The applied
foundation migration remains byte-for-byte unchanged.

The effective `service_role` contract is exactly `SELECT`, `INSERT`, and
`UPDATE`. `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN`, grant
option, ownership, schema grants, function grants, sequence grants, and default
privilege changes are outside the contract.

The migration fails closed unless all five ordinary tables exist, none is owned
or assumable by `service_role`, no inherited role path exists, browser/PUBLIC
grants are absent, and no target column depends on an identity or sequence.
Post-apply checks validate the direct and effective ACL before commit.

The `DBF Phase B Fact ACL Validation` check applies the foundation followed by
the corrective to a fresh PostgreSQL 17.6 database. It verifies exact ACLs,
RLS/FORCE RLS, index integrity, browser denial, rejected destructive operations,
and a rolled-back correction flow using only SELECT/INSERT/UPDATE. No fixture
row survives the test.

Reviewed migration: `20260814204346_dbf_business_data_phase1_service_role_acl_corrective.sql`
Canonical LF SHA-256: `108e10bd5998f825874783bae8ddb2253d5042b1f6d9049a72d52f67ff4cc5d4`
