# KPI Data Verification

## 判定

BLOCKED。

総客数、新規客数、既存客数、総単価、技術単価、店販売上、店販購買率、MID、EC、予算比、前年比、推移について、正式Source・算定定義・期間・freshness・read permissionが確定していない。

照合対象値は取得しておらず、Synthetic値との混同もない。KPI Engineまたは既存APIが正本として承認されるまでProduction Projectionへ接続しない。
