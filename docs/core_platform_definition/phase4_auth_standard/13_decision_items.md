# 13. Decision Items

決定者が承認するまで推奨案を標準確定と扱わない。

| ID | Decision | Options | Recommendation | Impact / Blocker | Owner | Due before |
|---|---|---|---|---|---|---|
| D-01 | HUB本人認証の標準 | Google/Firebase、passkey、併用 | Firebaseを当面維持しpasskey評価 | 全app入口 | CTO | Phase B |
| D-02 | email/PINの終了日 | 維持、段階廃止、即時廃止 | 代替確認後に段階廃止 | 現場アクセス | COO/HR | Phase C |
| D-03 | handoff署名方式 | HMAC、非対称鍵 | 非対称鍵 | issuer侵害範囲 | CTO/Security | Phase B |
| D-04 | handoff TTL | 30/60/120秒 | 60秒 | UXとreplay | Security | Phase B |
| D-05 | app session TTL | 固定、idle＋absolute | idle＋absolute | 操作性/失効 | Security/App | Phase C |
| D-06 | email fallback期限 | 無期限、2026-12-31、より早期 | 2026-12-31上限 | UID欠損184 active中 | HR/CTO | Phase C |
| D-07 | terminal identity方式 | 店舗共有、端末証明、個人のみ | 端末証明＋個人確認 | 勤怠/Concierge | COO/CTO | Phase B |
| D-08 | role/scope正本 | app別、public master、専用IAM | 当面public master＋Adapter | 認可一貫性 | CTO | Phase B |
| D-09 | service role許可主体 | 全backend、allowlist | allowlist | 最大security risk | CTO/Security | Phase B |
| D-10 | 監査保持期間 | 1/3/7年、区分別 | 法務確認の区分別 | コスト/法令 | Legal/Security | Phase C |
| D-11 | 高感度時のaudit障害 | fail open/closed | 書込み・特権はfail closed | 可用性 | CTO/Security | Phase B |
| D-12 | break-glass | なし、共有、個人承認 | 個人＋二者承認＋時限 | 障害対応 | CTO | Phase E |
| D-13 | inactive/retiredの例外 | 全拒否、限定例外 | 全拒否、復職は状態更新後 | 585 inactive | HR | Phase B |
| D-14 | legacy shared token終了 | 維持、日付指定廃止 | 日付指定廃止 | Task Manager blocker | App owner/CTO | Phase C |
| D-15 | Core Read Adapter運用主体 | 各app、Platform共通 | Platform共通 | scope強制/可用性 | CTO | Phase B |
| D-16 | 店舗営業Phase 0開始 | auth待ち、sandbox並行 | sandbox設計のみ並行 | MVP schedule | Business/CTO | Phase B |
| D-17 | 個人Firebase UIDの対象 | 全社員必須、利用者のみ、任意 | 全社員必須（service/terminal除外） | active UID欠損184がBlocker | CTO/HR | Phase B |
| D-18 | メールなし社員の初期ログイン | PIN、管理者招待、端末step-up | 本人確認済み管理者招待 | active email系欠損104 | HR/Security | Phase B |
| D-19 | FC owner scope | 法人、担当店舗、個別付与 | 契約法人＋明示店舗 | 越境防止Blocker | Business/Legal | Phase B |
| D-20 | platform_admin権限 | 全データ、運用のみ、都度昇格 | 運用のみ＋高感度は都度昇格 | PII過剰権限 | CTO/Security | Phase B |
| D-21 | 独自session移行期限 | 無期限、6か月、12か月 | app証跡後6か月 | legacy併存 | CTO/App owners | Phase C |
| D-22 | Expense HUB統合 | redirect、handoff wrapper、全面改修 | handoff wrapper | 完成資産保護 | Expense owner | Phase C |
| D-23 | 勤怠/Shift統合 | 共通化、個別維持、段階共通化 | Shift verifier基準で段階共通化 | 端末運用 | HR/Operations | Phase C |
| D-24 | legacy GAS終了 | 維持、日付指定、用途別例外 | 日付指定＋承認例外 | Google session依存 | CTO/App owners | Phase D |
| D-25 | service role是正順序 | app順、危険度順、利用数順 | 外部露出×広scope×高感度順 | P0 security Blocker | Security/CTO | Phase B |

## 承認記録

各Decisionは選択肢、決定理由、決定者、決定日時、発効日、再評価日を記録する。口頭合意や実装先行を承認とみなさない。
