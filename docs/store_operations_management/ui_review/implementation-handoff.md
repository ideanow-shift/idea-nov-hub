# Frontend実装引継ぎ

## 実装順

1. Design Token aliasと共通StatePanel
2. Page shell、Header、Filter、認可済みnavigation
3. Dashboard Summary→Priority→Decision Signals／Trend→Store List
4. Store List responsive table/card
5. Store Detail header、focus、4 tab、各breakdown
6. 状態保持、keyboard、screen reader、reduced motion
7. viewport・visual regression・Console確認

## 正本

- 認可／Role: [role_based_initial_view.md](role_based_initial_view.md)
- 状態: [state-design.md](state-design.md)
- Component: [component-specification.md](component-specification.md)
- 操作と保持: [interaction-specification.md](interaction-specification.md)、[navigation-state-retention.md](navigation-state-retention.md)
- Token: [design-tokens.md](design-tokens.md)
- 画面: Dashboard／List／Detail各layout文書

## 実装Acceptance

- 1366×768で対象月・mode・scope、Summary、状態件数、Priorityの存在、Decision Signals先頭が認識できる。
- 1440×900でPriority最大3件とDecision Signalsの先頭行まで確認できる。
- 1920×1080でもcontentは1480px以内で、過度に伸長しない。
- 1024px未満はtableをcardへ切替、620px以下は1列、横scrollなし。
- 全runtime／auth状態で文言と操作が正本通り。ForbiddenとEmpty、collectingとAPI未接続を混同しない。
- keyboardのみでfilter、card、table、tab、戻るが操作できる。focus消失なし。
- Preview Mock IdentityはPreview限定。ProductionにMock control／banner／fallbackなし。
- Console Error 0、Console Warning 0、既存testの新規Fail 0。

## 実装者が決めてはいけない事項

RoleやScopeの推測、利益nullの0変換、FC利益表示、許可外option表示、Synthetic fallback、新KPI、新画面、独自login、状態文言の独自変更、componentごとの任意色・余白追加は禁止する。

## UI外のblocking input

正式API endpoint、Projection key、Session transport、HUB header実測高は実装開始前にintegration ownerが提供する。未提供でもUI componentとfixture stateの実装は開始できるが、推測してProduction接続しない。

