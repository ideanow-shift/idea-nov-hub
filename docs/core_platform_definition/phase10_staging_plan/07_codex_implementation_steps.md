# Codex Implementation Steps

Phase 11で明示承認後にCodexが行える作業:

1. staging専用config templateとproduction deny guardを作成。
2. three-schema migrationとsynthetic seedを作成。
3. atomic handoff store、audit table、retention SQLを作成。
4. canary Edge endpointsとbrowser testを実装。
5. GitHub Actions workflowを作成。ただしenvironment approval必須。
6. Secret名だけを参照し、値は読出し・commitしない。
7. dry-run、lint、unit、local integrationを実行。
8. Owner承認後だけstaging migration/deployを実行。
9. HTTPS/browser/concurrency/rollback rehearsalを記録。

Codex単独ではproject、billing、DNS、authorized domain、test user、GitHub environment approvalを作成・確定しません。production refを検出した場合は即停止します。
