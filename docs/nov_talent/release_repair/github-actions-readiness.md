# GitHub Actions readiness

The existing `.github/workflows/deploy-pages.yml` is reused. Pull requests touching Talent/HUB paths run a non-deploying `talent-release-checks` job with:

1. JavaScript syntax checks.
2. NOV Talent, HUB boundary and Store boundary fixed regressions.
3. `git diff --check` against `origin/main`.
4. committed-secret pattern rejection for Talent assets.
5. Production Mock Identity rejection tests.

The Pages deploy job is restricted to an explicit `workflow_dispatch` with `production_approved=true` and depends on the check job. Pull requests cannot deploy, and a merge alone does not deploy.

Remote results:

- PR A (`#15`, head `61060cf84f7a03338e2599c777479e3355043a02`): pull-request run `30674420666` succeeded; `talent-release-checks` passed and `deploy` was skipped.
- PR B (`#16`, head `5afc2251d311acc8ac9bb5b6dfc0d5b7a9819b37`): pull-request run `30674623804` succeeded; `talent-release-checks` passed and `deploy` was skipped.
- The runner emitted one platform deprecation warning for the Node runtime used internally by `actions/checkout@v4` / `actions/setup-node@v4`; it is not a NOV Talent test failure.
