# 店舗営業管理 Phase 0 サマリー

調査日: 2026-07-28

対象: 本リポジトリのコード、SQL、設計書、テスト、既存画面

制約: 読み取り専用調査と文書作成のみ。本番環境、NOV HUB、IDEA LINKは変更していない。

## 総合判定

**Conditional Go**。Phase 1は「正式な売上原本と業務ルールの確定、サンプルCSVによる契約検証、既存画面のread-only接続設計」に限定して開始できる。本番取込、DB write、KPI正式運用、deployはNo-Goである。

既存完成度の目安は**約40%**。画面骨格、ローカルCSV検証、Core master、認証・scopeの設計資産は再利用できる。一方、正式な売上原本、取引明細モデル、締め・取消・返品・訂正、永続取込、確定KPI契約が未確定であり、業務システムとしての完成度は低い。

## 結論

- 最大の不足はフロントエンドではなく、**店舗売上の正式原本とその意味を固定する契約**である。
- `portal/management-app/` はReuse/Extend対象だが、現在の店舗API値は売上実績ではなくゼロ値のplaceholderを含む。
- `public.employees`、`public.stores`、`public.corporations` はCore Read Adapter越しにReuseする。
- `management_performance_snapshots` は派生集計としてExtendできるが、売上原本にはできない。
- 現時点で確認できる入力経路はlocal CSV previewである。POS、SalonAnswer、Salon Board、Reservia、Spreadsheet、外部APIの本番正本はUnknown。
- 社員マスタは再構築せず、直属上長関係、構造化されたarea assignment、状態・有効日データ品質だけを補う。

## 推奨MVP

1. 店舗別月次の総売上、技術売上、店販売上、客数
2. 予算対比、前年対比
3. スタッフ別売上
4. KPIを分離表示した生産性
5. 店舗ランキング
6. 店長コメント
7. 営業部向け全店舗一覧

日次速報、AI分析、予測、複雑な顧客コホート、収益性は後続とする。

## Gateを開く必須条件

- 正式データ元、提供責任者、月次締め時刻、再取得方法を決定する。
- 税、値引き、取消、返品、訂正、営業日、締めの定義を承認する。
- 売上・客数・スタッフ売上のキーとCSV例を固定する。
- KPI定義を人員、稼働人員、時間、FTEで分離して承認する。
- synthetic staging、rollback owner、negative test ownerを決める。
