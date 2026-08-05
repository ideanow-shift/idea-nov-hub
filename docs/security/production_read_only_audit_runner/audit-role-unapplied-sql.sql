-- UNAPPLIED TEMPLATE. Production execution is prohibited in this sprint.
-- Replace the expiry token only inside the separately approved private DBA session.
-- No password, URL, project identity, or Secret belongs in this file.

CREATE ROLE idea_nov_prod_audit
  LOGIN
  NOINHERIT
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS
  CONNECTION LIMIT 1
  VALID UNTIL '<APPROVED_UTC_EXPIRY>';

REVOKE ALL ON DATABASE postgres FROM idea_nov_prod_audit;
GRANT CONNECT ON DATABASE postgres TO idea_nov_prod_audit;
GRANT USAGE ON SCHEMA public TO idea_nov_prod_audit;
GRANT SELECT ON TABLE public.employees, public.stores, public.corporations,
  public.departments, public.employee_store_assignments TO idea_nov_prod_audit;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public, core FROM idea_nov_prod_audit;
ALTER ROLE idea_nov_prod_audit SET search_path = pg_catalog, information_schema;
ALTER ROLE idea_nov_prod_audit SET statement_timeout = '5s';
ALTER ROLE idea_nov_prod_audit SET lock_timeout = '1s';
ALTER ROLE idea_nov_prod_audit SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE idea_nov_prod_audit SET default_transaction_read_only = on;

-- Credential provisioning, role membership review, default-privilege review,
-- and a private production identity check are separate approval gates.
