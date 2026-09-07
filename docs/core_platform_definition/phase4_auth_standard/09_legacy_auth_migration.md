# 09. Legacy Authentication Migration

## 方針

既存ログインを一括削除しない。現行経路を棚卸し、HUB handoffと共通Identity Resolutionを前段に追加し、利用実績・negative test・rollbackを確認してから段階的に縮退する。

| 対象 | 現状 | 当面 | 到達点 | 判定 |
|---|---|---|---|---|
| NOV HUB | Firebase Google、email/PIN、Edge session | 維持しhandoff発行元を限定 | 共通入口、強い本人認証 | migrate |
| IDEA LINK | HUB context/handoff | 署名・aud・nonce・一回交換を標準化 | 共通handoff | wrap |
| Expense Hub | 独立URL、独自認証 | server-side actor解決を維持 | HUB sessionへ統合 | migrate |
| 勤怠 | PIN/query token/custom | 端末principalと従業員actorを分離 | 端末認証＋従業員確認 | migrate |
| Shift | 署名HUB session、role/scope確認 | 基準実装として維持 | 共通contract準拠 | maintain |
| NOV Talent | HUB共有session候補 | 実装確認まで変更なし | 共通session/handoff | unknown |
| NOV Navi | 認証実装未確認 | 露出範囲を限定 | 共通handoff | unknown |
| Management Platform | HUB context/static | static trustを縮退 | 共通handoff | migrate |
| 環境整備 | 認証実装未確認 | 調査・現状維持 | 共通handoff | unknown |
| 法人経営管理 | 認証実装未確認 | 調査・現状維持 | HQ scope contract | unknown |
| 店舗営業管理 | 未実装/定義中 | Phase 0はsandbox限定 | 最初から共通contract | new |
| 現職者管理 | 認証実装未確認 | 調査・現状維持 | HR sensitivity contract | unknown |
| Decision Hub | HUB関連、詳細未確認 | 書込み経路を先に調査 | 共通handoff＋高感度監査 | unknown |
| タスク管理 | 共有API token、actor/store scopeなし | 外部露出を増やさない | service principal＋user delegation | retire |
| Concierge | 店舗共通ID/password、独自session | 店舗端末として明示 | terminal principal contract | migrate |
| Education | GAS Google session候補 | Google session依存を確認 | federated handoff | unknown |
| LINE WORKS | 外部連携 | bot/service principalを明示 | service contract | wrap |
| Notification Engine | サービス間実行 | user actor委任を別フィールド化 | service contract | wrap |
| 旧THANKS | Legacy機能、詳細未確認 | 新規依存を禁止し現状調査 | archiveまたは後継移行 | unknown |
| その他GAS | Google session / script実行が混在 | script単位でownerとcredential確認 | federated handoffまたはservice contract | unknown |

## PIN縮退条件

PINは本人認証の恒久正本にしない。経過期間中もrate limit、失敗監査、ロック、平文非保存、退職・無効化即時反映が必要。PIN廃止日は利用者影響、端末要件、代替認証を経営判断後に設定する。

## ロールバック

各アプリ単位で切替feature flag、旧経路の期限付き復帰手順、session全失効、問い合わせ窓口を準備する。ロールバックは旧方式の無期限併存を意味せず、復帰期限と再判定日を必須とする。
