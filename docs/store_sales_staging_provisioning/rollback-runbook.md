# Staging Rollback Runbook

1. Disable the Staging function route or remove its protected API URL configuration.
2. Revoke Store Master and Accounting port credentials.
3. Revoke the Staging session verifier key/audience binding.
4. Preserve only sanitized deployment receipt and E2E categories; do not retain secret values or raw responses.
5. Restore the prior disabled/no-runtime-binding state.
6. Require a fresh approval for any retry. No automatic retry and no Production fallback are allowed.
