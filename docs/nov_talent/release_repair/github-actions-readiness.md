# GitHub Actions readiness

The existing `.github/workflows/deploy-pages.yml` is reused. Pull requests touching Talent/HUB paths run a non-deploying `talent-release-checks` job with:

1. JavaScript syntax checks.
2. NOV Talent, HUB boundary and Store boundary fixed regressions.
3. `git diff --check` against `origin/main`.
4. committed-secret pattern rejection for Talent assets.
5. Production Mock Identity rejection tests.

The Pages deploy job is restricted to a push on `main` and depends on the check job. Pull requests cannot deploy.

Remote results:

- PR A (`#15`): manual `workflow_dispatch` run `30671911695` succeeded; `talent-release-checks` passed and `deploy` was skipped.
- PR B (`#16`): pull-request run `30671791776` succeeded; the non-deploying release checks passed.
- The runner emitted one platform deprecation warning for the Node runtime used internally by `actions/checkout@v4` / `actions/setup-node@v4`; it is not a NOV Talent test failure.
