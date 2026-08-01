# GitHub Actions readiness

The existing `.github/workflows/deploy-pages.yml` is reused. Pull requests touching Talent/HUB paths run a non-deploying `talent-release-checks` job with:

1. JavaScript syntax checks.
2. NOV Talent, HUB boundary and Store boundary fixed regressions.
3. `git diff --check` against `origin/main`.
4. committed-secret pattern rejection for Talent assets.
5. Production Mock Identity rejection tests.

The Pages deploy job is restricted to a push on `main` and depends on the check job. Pull requests cannot deploy. GitHub Actions status is recorded in the final handoff after both draft PRs are created.
