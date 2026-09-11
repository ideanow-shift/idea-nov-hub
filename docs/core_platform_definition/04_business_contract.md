# Business Contract

全システムで同じ語を同じ意味・ID・時点で扱うための暫定辞書。`Proposed` であり、業務owner承認前に実装へ固定しない。

## 組織

| 用語 | 正式定義 | 集計単位/参照元 | 更新責任 | 未確定 |
| --- | --- | --- | --- | --- |
| 法人 | 法人格/経営集計の主体 | corporation ID / Core | Core owner | FC法人表現 |
| 店舗 | 営業活動の物理/管理拠点 | store ID / Core | Core owner | 閉店後参照 |
| 直営店/FC店 | ownership区分を持つ店舗 | store type + corporation | Core owner | 判定属性 |
| 部署 | 組織上の部門 | department ID / Core | 人事→Core承認 | 階層 |
| 所属 | employeeと組織の有効期間付き関係 | assignment history | 人事 | 現在値導出 |
| 兼務 | 同一期間の副所属 | store assignment | 人事 | 優先順位 |
| 在籍/休職/退職 | 雇用状態のeffective-dated状態 | employee/history | 人事 | 状態遷移 |

## 売上

| 用語 | 正式定義 | 集計単位 | 更新責任 | 未確定 |
| --- | --- | --- | --- | --- |
| 総売上 | 税・値引・取消・返品前後を明示した取引集計 | store × business date | 店舗営業 | 採用式 |
| 技術売上 | approved service categoryの純売上 | 同上 | 店舗営業 | category owner |
| 店販売上 | approved retail categoryの純売上 | 同上 | 店舗営業 | セット按分 |
| 指名/指名外売上 | 担当者属性による売上区分 | employee × date | 店舗営業 | 担当変更 |
| 値引/取消/返品/訂正 | 原取引へ関連付く調整イベント | transaction | 店舗営業 | 過月訂正 |
| 売上確定 | version、digest、承認者を持つ締め結果 | store × period | 店長/営業 | 再open権限 |
| 営業日 | 店舗timezoneと境界時刻で決まる日 | store | 営業 | 境界時刻 |

## 顧客・人員・採用

顧客数、新規/既存/再来/指名客、客単価、新規/既存来店率は、顧客識別子、重複排除、期間、匿名客を決めてから確定する。在籍人数、稼働人数、出勤人数、FTEはas-of時点、勤務時間、休職の扱いを必須属性にする。

採用は候補者→応募→見学→面接→内定→入社予定→現職者の状態遷移で扱う。現職者管理への移管は承認済みonboarding caseを唯一の入口とし、選考メモ全文や不要PIIを渡さない。

## 共通必須属性

正式定義、ID、source、owner、timezone、effective period、version、status、訂正規則、利用アプリ、PII分類、未確定事項を各契約に持たせる。
