# Risk and Technical Debt

| priority | risk | affected | evidence | mitigation |
| --- | --- | --- | --- | --- |
| Critical | service role経由でactor/scope検証が欠落する可能性 | Edge API全般 | core auth ADR、複数service-role API | negative auth testsと監査契約 |
| Critical | Core Master二重化 | 全アプリ | public 775/22/6 vs core各1 | ADR-001、adapter、single writer |
| High | 本番カード正本と静的定義の乖離 | HUB/教育/THANKS | portal_apps監査 | DB read-only定期diff |
| High | 旧THANKSとIDEA LINK重複 | Communication | 両方activeの監査結果 | 現行正本をidea-linkに固定 |
| High | 本番運用とGit commit/repoの追跡不足 | 勤怠/教育/GAS/経理 | 複数checkout・成果物 | deployment manifest |
| High | UID/email/PINの誤紐付け | 全認証 | auth boundary未確定点 | uniqueness audit、fallback期限 |
| Medium | HUB role判定がfrontend alias/固定配列にも依存 | Portal/apps | main.js/apps.js | server policyへ寄せる |
| Medium | Task/Decision、Talent/HR、Management/環境整備の重複 | 複数 | routeとHUBカード | capability ownership map |
| Medium | GAS/Sheets残存 | Education/legacy | old URL、retirement資料 | 読取→shadow→cutover |
| Medium | testsがstatic fixture中心 | 新規modules | tests/review多数 | live integration/E2E gate |

## 最大の全体リスク

認証済み本人とCore employee、role/scope、service-role DB操作が一つの検証済み契約で結ばれていない場合、誤社員紐付けまたは越権アクセスが複数アプリに横断波及すること。

