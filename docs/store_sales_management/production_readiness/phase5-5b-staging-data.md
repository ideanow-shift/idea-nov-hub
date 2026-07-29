# Phase 5-5B Staging Data

## Stage

Stage 1 Syntheticのみ。20 test店舗、7 actor、Direct/FC/休業/閉店、5 data states、4 Store Statusを含む。名称・ID・versionは`Synthetic`/`synthetic-*`で識別する。

実店舗名、実会計金額、個人名、email、token、production UUIDは使わない。表示金額はUI/contract動作確認用の架空値であり、`synthetic=true`とprovenance markerを返す。

## Seed Plan

seedはcode fixtureから決定的に生成し、production artifactから除外する。DB seedへ移す場合はStaging projectだけを対象に、seed version/hash、削除、再投入、auditを記録する。

## Storage Plan

Stage 1はStorage不使用。Stage 2以降は専用private bucket、masked data approval、短時間signed URL、path scope、retention/deletionを承認後に導入。

## Business Limits

利益はsynthetic confirmed/collecting/preparingの表示確認用。税・mapping・未承認dictionaryを確定しない。ECは店舗配賦しない。
