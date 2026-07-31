# Release Validation Checklist

## Dashboard V1.1

- [ ] Six executive signals are present
- [ ] Sales shows budget and prior-year ratios
- [ ] Profit shows operating profit and margin or collecting state
- [ ] Customer totals include total/new/existing
- [ ] Product shows MID and EC reference values
- [ ] Shared trend shows current and prior lines
- [ ] Store List shows assigned AM

## HUB integration

- [ ] Card name is `店舗営業管理`
- [ ] Description is `売上・利益・KPI・店舗運営を確認`
- [ ] No separate Store Operations login exists
- [ ] Representative sees all stores
- [ ] Sales manager sees 13 direct stores
- [ ] Area manager sees only assigned stores
- [ ] Store manager opens own-store detail
- [ ] General employee card is absent
- [ ] General employee direct URL is forbidden
- [ ] Missing and expired sessions are distinct
- [ ] HUB return route works
- [ ] Preview Mock Identity is unavailable in integration/staging/production

## Regression and release evidence

- [ ] NOV Talent card and session flow unchanged
- [ ] IDEA LINK, Finance, Attendance cards unchanged
- [ ] One canonical App Registry record; legacy ID is alias only
- [ ] Store Operations tests: 236/236 PASS or better
- [ ] New full-suite failures: 0
- [ ] Console Error: 0
- [ ] Console Warning: 0
- [ ] `node --check`: PASS
- [ ] `git diff --check`: PASS
- [ ] Deployment approval and rollback owner recorded
