# Next Implementation Gate

## 結論

店舗営業管理MVPの実装へは **まだ進めない**。設計上の優先順位は正しいが、以下のP0証跡が不足する。

## Go条件

- ADR-001でpublic/core物理正本を承認。
- ライブRLS、Policy、GRANT、SECURITY DEFINER、Storage policyをSELECT-only取得。
- UID/email/employee mapping重複・欠損が解消または拒否設計で管理可能。
- 店舗営業のrole/scope/actionとnegative testsを業務ownerが承認。
- 売上原本、営業日、税、値引、取消、返品、訂正、締めを営業・経理が承認。
- KPI ContractのMVP対象と式を承認。
- Core read adapter I/Oとsnapshot contractを承認。
- production dataを書かない検証環境とrollback ownerを確保。

## Go後の最初の実装範囲

Phase 0として、read-only Core adapter、source fixture、import dry-run、KPI計算fixture、authorization negative test harnessだけを作る。DB migration、Core Master変更、本番deployは含めない。

## Blocker

最大BlockerはライブDB権限が未確定なこと。次に売上原本/KPIの業務決定、identity mappingの実数検証である。現職者管理はさらにHR PII分類と採用handoff承認が必要。
