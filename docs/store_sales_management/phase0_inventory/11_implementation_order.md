# 実装順序

## Phase 1: Data Contract Gate

1. 正式sourceとownerを決定
2. 匿名化sample exportを入手
3. 税、値引、取消、返品、訂正、締め、営業日を決定
4. store/staff/customer/transaction keyを固定
5. KPIと予算のdefinition/versionを固定
6. golden fixturesとexpected totalsを作成

この段階は設計・fixture・testまで。本番writeはしない。

## Phase 2: Staging ingestion

1. import batchとimmutable source identity
2. parse/validation/quarantine
3. external ID mapping
4. canonical monthly facts
5. idempotency、correction、reconciliation
6. auditとrollback rehearsal

分離stagingの承認後に限る。

## Phase 3: Read model / authorization

1. Core Read Adapter
2. sales monthly snapshot
3. role × scope × action negative tests
4. store/corporation/area scope
5. API timeout/stale/closed state

## Phase 4: Existing UI extension

1. placeholderをread modelへ置換
2. 店長月次画面
3. 営業部一覧/ランキング
4. 経営者法人/直営FC比較
5. コメントと状態表示
6. mobile/browser regression

## Phase 5: Limited canary

synthetic staging、allowlist、kill switch、audit、rollbackに合格後、限定canaryを別Gateで判断する。

## 並行してはいけないもの

source contract未確定のままDB schema、KPI画面、本番importを同時実装しない。まず正解データを固定し、次に保存、読取、UIの順で進める。
