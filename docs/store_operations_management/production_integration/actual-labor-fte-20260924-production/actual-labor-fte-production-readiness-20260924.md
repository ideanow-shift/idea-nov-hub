# 実労働FTE Production実行準備

- Project: `nkmxevmioczcmnldreyo`
- Status: Production DB実行は未承認・未実施
- Fixed input SHA-256: `3D456AF80CFC2D60873A34E82F4A370CDE491884C604C3EB4ADBDC4777AF4157`
- Sanitized canonical SHA-256: `ED36524E26E78A5758B6A7CF82FF772BC546595197AED57DEE7ED1863084FF01`
- Canonical candidate: 671件（36か月、20店舗、重複0）
- Production昇格候補: 666件
- 法人帰属履歴未解決: 5件（KYARA HALF、2023-09～2024-01）
- 予定: definition 1件、source 1件、batch 41件、
  raw/staging 各671件、canonical 666件、staging-only 5件
- 既存Fact直接更新: 0件
- 削除: 0件
- 未配賦: 445社員月（canonicalへ推測投入しない）
- NULL→0変換: 0件

## 固定定義

タイムカード社員月総実労働時間を同月の正式な店舗配置FTE比率で配賦し、
173.76時間を1.0FTEとして保持します。実際の打刻店舗・応援先を示す値ではありません。
実勤怠がない月、名寄せ不能、配置なし、FTE=0は推測補完しません。
KYARA HALFの2023-09～2024-01はCore DBの法人帰属履歴がないため、現在法人へ
backcastせず、`MISSING_EFFECTIVE_OPERATOR`としてraw/stagingに隔離保持し、
canonical昇格対象外とします。

## 実行ゲート

この成果物はレビュー、静的・mock検証、read-only dry-runのためのものです。
Production DBでDDL/DMLを実行するには、固定main SHAとexecution SQL SHAを指定した
Ownerの別承認が必要です。deployとPR mergeもこの成果物では承認されていません。
