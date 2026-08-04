# UI Component仕様

共通規則: interactive要素はkeyboard操作可能、focus-visibleあり、touch target 44×44px以上。disabledとhiddenをPermission判断の代替にせず、Server許可結果を入力にする。

| Component | 目的／必須props | Variant・size | 状態・Interaction | Responsive／A11y／禁止 |
| --- | --- | --- | --- | --- |
| `PageHeader` | title、対象月、mode、scope、updatedAt | desktop horizontal / compact stacked | 対象条件変更 | h1は1個。Productionでdev control禁止 |
| `PreviewBanner` | preview label、disclaimer | subtle / warning | static | `role=status`不要。Production非表示 |
| `ScopeControl` | allowed options、selected | segmented / compact select | selected、disabled-with-reason | 許可外optionは原則hidden。URLだけで拡張禁止 |
| `ExecutiveSummary` | conclusion、sales、profitState、attentionCount、statusCounts | all/direct/FC/assigned/store | loading/partial/error | h2＋dl。全店利益と誤認させない |
| `MetricTile` | label、valueまたはstate、period | primary/secondary | confirmed/collecting/preparing/unavailable | valueと単位を分離。nullを0にしない |
| `StatusBadge` | status、label | good/stable/improving/attention | static | 色のみ禁止、28px高以上 |
| `PriorityActionCard` | store、theme、evidence、impact、nextLabel | max 3件 | hover/focus/loading | card全体linkにせず明示CTA。最低240px PC |
| `DecisionSignalCard` | signal、conclusion、lead、metrics | 6種、selected | clickでchart切替＋scroll | `aria-pressed`、見出しと結論必須 |
| `SharedTrendChart` | metric、period、current、previous、units | 6 metrics × 3 periods | loading/empty/error | SVG title/desc、legend、数値要約。色だけ禁止 |
| `FilterBar` | allowed scope、status、query、sort | sticky desktop / trigger mobile | dirty/loading/applied | field label必須。Mobileはsheet、横scroll禁止 |
| `StoreTable` | authorized rows、visible columns、sort | desktop ≥1024 | loading/empty/error | semantic table。行Enterで詳細、第一列sticky |
| `StoreCard` | store、status、theme、sales、profitState、keyDelta | tablet/mobile | pressed/focus | card内dl。利益権限なしは項目非表示 |
| `DetailHeader` | backContext、store、period、status、profitState、conclusion | desktop/stacked | loading/error | back buttonの戻り先label明示 |
| `ManagerFocus` | priority、reason、nextAction | normal/attention | static | 最大3文、AI断定表現禁止 |
| `Tabs` | 4 tab、selected | horizontal scroll mobile | selected/focus | tablist/tab/tabpanel、arrow key対応 |
| `KpiCard` | label、value/state、comparison、period | lead/supporting | all runtime states | 主値→比較→注記。tooltipのみ禁止 |
| `BreakdownBar` | total、segments、labels | sales/customer | empty/partial | text values併記、segmentのみで伝えない |
| `StatePanel` | state、scope、message、action | page/section/inline | 全状態 | [state-design](state-design.md)を正本とする |
| `MobileFilterSheet` | fields、apply、clear、count | modal bottom sheet | open/dirty/loading | focus trap、Esc、背景scroll lock、閉じてfocus復元 |

Optional propsは補足説明、確定予定、source label、comparison period、secondary actionに限る。Optional不在で空の枠や`-`を出さない。

