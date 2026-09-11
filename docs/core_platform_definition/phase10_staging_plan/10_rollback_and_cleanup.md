# Rollback and Cleanup

## Rollback order

1. server-side kill switch ON。
2. app/global/environment flags OFF。
3. deploy workflow停止。
4. active/unused one-time codes revoke。
5. app sessions revoke。
6. previous verified Edge versionへ戻す。
7. Hosting prior releaseへ戻す。
8. audit integrityとrollback eventを確認。

## Cleanup

- synthetic test users削除。
- authorized domain削除。
- GitHub environment Secrets revoke/delete。
- signing/private/service keys rotate。
- Edge Functions削除。
- audit retention期間後、Supabase staging project削除。
- Firebase staging project disable/delete。
- billing dashboardで新規usage停止を確認。

Supabaseはproject削除後にURLが停止し復元不可、billingは削除時点以降停止すると公式説明があります。[Deleting a Supabase project](https://supabase.com/docs/guides/platform/delete-project) Free projectはpauseも可能ですが、Secret漏えい時は削除/rotationを優先します。
