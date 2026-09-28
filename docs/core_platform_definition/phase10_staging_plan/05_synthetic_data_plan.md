# Synthetic Data Plan

## 件数

- corporation: 2
- store: 4（各corporation 2、全て架空名）
- employee principal: active、inactive、retired、store manager、area manager、FC owner、general employee
- terminal principal: 1
- service principal: 1
- duplicate UID: 2 records
- unknown UID: repositoryに存在しないtest input
- multiple assignments: 1 employeeに2 stores
- cross-corporation scope: deny用actor/resource

## Naming

`Synthetic Corporation Alpha`、`Synthetic Store A1`、`employee01@invalid.example`等、予約domainと明示的synthetic UUIDを使います。実名、実email、電話、店舗名、法人名、売上、人事履歴を使用しません。

## Lifecycle

fixtureをversion管理し、migrationはstaging projectだけをtarget確認後に別承認で実行します。seedはidempotent、expected count付き。cleanupはschema dropではなくproject破棄を第一選択とし、audit retention承認後に行います。
