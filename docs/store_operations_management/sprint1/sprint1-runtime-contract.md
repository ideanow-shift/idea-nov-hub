# Sprint 1 Mock Runtime Contract

UIの唯一のデータ入口は`createStoreSalesRuntime()`。Mock Adapterは`getReviewFixture()`からProjectionを返す。UIコンポーネント内に店舗Mock値を持たない。

Runtime states: `initializing`, `loading`, `ready`, `empty`, `unauthorized`, `forbidden`, `validation_error`, `maintenance`, `timeout`, `offline`。

Data states: `available`, `collecting`, `preparing`, `unavailable`, `validation_error`。`available`以外の`displayValue`は必ず`null`で、集計中を0円へ変換しない。

Roles:
- `representative`: 全20店舗、全店の状況
- `sales_manager`: 直営13店舗、要対応を初期選択
- `area_manager`: 担当5店舗
- `store_manager`: 立川店1店舗、店舗詳細へ直接着地

識別子は`mock-store-01`形式で、実Store UUIDとは明確に分離する。Mock controlsは`index.html`の開発面に限定し、Production feature flagは既存Adapter policyで拒否される。
