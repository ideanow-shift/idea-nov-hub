# Remaining Blockers

## P0 before real staging rollout

1. 管理されたstaging環境、非production Firebase project、synthetic Core DBのowner確定。
2. KMS/HSMまたはSecret manager、JWKS、key rotation/revoke runbook。
3. Redis等による複数host atomic consumeと障害・failover test。
4. 信頼できるHTTPS domainでSecure/SameSite/cross-origin POST bridge再検証。
5. live形状のCore Read Adapter、scope二重防御、cache invalidation。
6. 永続audit sink、retention、access control、monitoring。
7. Phase 3のservice role、GRANT、SECURITY DEFINER remediation。
8. live Firebase UID mapping欠損・重複防止運用。

## P1 before production

- distributed clock、network partition、load/soak、DR、incident response。
- CSRF/CORS/CSP/Referrer-Policyの実domain検証。
- app owner、rollback owner、SLO、support runbook。

外部stagingを新規作成・契約しておらず、production資源は一切変更していない。
