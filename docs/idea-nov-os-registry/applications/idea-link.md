# IDEA LINK／サンクスコイン

- 目的・利用者: 全社員の感謝・称賛・理念行動共有。
- 機能: コイン/投稿、分析、組織健康観測、follow-up、通知。
- 判定: **Production / 90% / 本番運用あり**
- URL/repo: HUB内 `./idea-link-app/`; repoはHUB、別履歴checkoutあり。
- 技術/認証/DB: static frontend + `nov-hub-api`/Supabase; HUB handoff、Core roles。
- Core/Table: employees, stores, employee_roles、idea-link activity/followup系（ライブ一覧未確認）。
- 外部/HUB: HUB card/session、Notification/LINE WORKS候補。
- 更新責任: IDEA LINK owner未確認。Core Masterは参照のみ。
- 依存: HUB/Auth/Core/Edge。HUBの文化・通知画面が本機能に依存。
- 完成済み: frontend/backend tests、analytics、health observation、活動follow-up。
- 未完成/不具合: `THANKS`旧GASカードとの重複。本番最新commit未照合。
- セキュリティ: actor/recipient/coin量のserver検証、二重送信、service role。
- 推奨: 維持改善。`idea-link`を正本、`THANKS`は凍結候補。
- 根拠: `portal/idea-link-app/`, `supabase/functions/nov-hub-api/`, `review/idealink-*`, `docs/hub-portal-apps-display-audit-20260717.md`
- 最終確認: 残高正本、監査/取消、通知、live card。

