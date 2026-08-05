# Execution Window Approval

## 単発実行枠の必須記載

```yaml
run_id: human-approved-opaque-id
purpose: catalog_only_smoke | approved_store_master_fact_verification
approved_query_ids: [C01_TARGET_RELATIONS, C02_COLUMN_SHAPE, C03_CONSTRAINTS, C04_INDEXES, C05_RLS_POLICIES, C06_GRANT_SUMMARY, C07_ROW_COUNTS, C08_STATUS_COLUMN_CANDIDATES, C09_RELATION_DEPENDENCIES, C10_READONLY_GUARD_VERIFICATION]
scheduled_start_jst: approved_timestamp
window_minutes_max: 5
runner_wall_clock_seconds_max: 60
retry: 0
approvers:
  representative: approved
  os_owner: approved
  db_owner: approved
```

開始前にprofile、sealed package、Role、実行枠の全てを確認する。1つでも不一致なら起動せずquery 0件。実行後の成功・失敗を問わず、runnerはrollback/closeを確認して終了する。失敗、timeout、不一致、結果schema不正は新しい原因レビューと三者再承認なしに再実行しない。
