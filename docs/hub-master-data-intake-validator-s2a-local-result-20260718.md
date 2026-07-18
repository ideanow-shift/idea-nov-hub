# HUB Master Data Intake validator S2a local result 2026-07-18

```yaml
result: LOCAL_SQL_REHEARSAL_PASS
case_id: hub-data-intake-validator-s2a
valid_target_cases: 3
negative_cases: 7
fixture_pass_count: 10
fixture_total_count: 10
browser_execute_grant_count: 0
service_role_execute_grant_count: 1
security_definer: true
fixed_search_path: true
rollback: pass
clean: pass
production_access_count: 0
host_port_count: 0
```

The validator returned only sanitized aggregate output. It did not write receipt, master, profile, audit, authentication, notification, or external-system data.

Production function creation and grant remain unapproved. S2b atomic commit RPC design remains the next database source slice.
