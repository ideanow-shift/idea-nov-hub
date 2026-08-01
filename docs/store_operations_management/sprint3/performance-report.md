# Sprint 3 Performance Report

## 判定

営業部レビュー対象の20店舗は問題なし。500店舗Synthetic配列のfilter/sortはテスト環境で100ms未満。

## 対応

- 店舗scope・状態filter・sort結果をmemo化。
- projection配列を破壊しない`toSorted`を使用。
- 同条件の再描画では同じ選択結果を再利用。
- 古いnetwork responseの描画を抑止。

Virtual Scrollは現時点では導入しない。20店舗では複雑性が便益を上回り、数百店舗でもselector処理は許容範囲。実データ接続後にDOM行数と端末実測を基に再判定する。
