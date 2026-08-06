# Design Recommendation

## 最終提案

現在の2階層構造と機能境界を維持し、情報の主従、文章、responsive順序を再設計する。新しい画面やKPIは追加しない。

## P0 — V1デザイン確定前に必須

1. Executive Summaryを結論1〜2文→主数値3件→状態分布の順に固定する
2. 優先アクションを最大3件、改善テーマ主語、根拠KPI・差分・影響度・次に確認を必須にする
3. 店舗状態と利益／データ／system状態のvisual grammarを分離する
4. 客数、単価、EC按分、生産性について、今回V1指示と既存Data Contractの差を人間が承認する
5. 店舗状態の説明責任を決め、関連KPIと理由へ到達可能にする
6. 元の添付営業管理画像を入手し、認知上の強みの分析を再確認する
7. Design Systemで未確定の状態色、icon、table density、chart paletteを共通仕様として承認する
8. 正式Permission Key／Bundle名、営業部長のcanonical department relation、Production assignment制約をCore DB/Auth契約として確定する

## P1 — V1で完成

1. 業績ドライバーを4群へ整理し、主KPIと補助KPIを視覚分離する
2. Dashboardの月別推移を1つに限定し、当年／前年、必要時予算を比較する
3. Portfolioをコンパクトな状態Filterとし、一覧との重複を除く
4. PC店舗一覧の主要列、補助列、1366／1440／1920pxの表示規則を確定する
5. MobileをSummary→状態→Action→Driver→店舗カードの順で設計する
6. 店舗詳細を結論→今月重点→次に確認→4区分へ整理する
7. 利益の確定／集計中／準備中と確定予定を明示する
8. 一覧へ戻る際の対象月、Scope、Filter、sort、列、scroll保持を受入条件にする
9. Role別に5分task testを行う

## P2 — V2以降

POS、日次進捗、月末予測、リアルタイム、スタッフ個人分析、アクション履歴、施策効果、自動異常検知、高度差異分解、benchmark、custom Dashboard、保存済み表示、高度通知、健康score表示、会話型AI。

## 実装前の人間判断

- V1 UI対象KPIと実際のPublished Projectionの整合
- EC按分の業務定義と二重計上防止
- 店舗状態の説明文と責任Owner
- 優先アクションのServer-side根拠と更新頻度
- 副社長Roleの正式Scope
- Design Systemの暫定提案を共通仕様へ昇格するか
- 5分UX testの参加者、fixture、合格基準
- `employee_store_assignments`のProduction制約と期間判定証跡
- アプリ利用、非利益KPI、確定利益・利益率の正式Permission Key／Bundle名
