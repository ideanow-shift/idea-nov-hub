# Release Readiness

## 判定

Source-ready / Production connection blocked.

## 完了

- Environment別Data Source境界
- Store Sales API read-only Adapter
- Dashboard / Store Detail GET
- HUB bearer Session transport
- server-resolved scope前提
- Profit Contract D01〜D05
- null state enforcement
- Production Synthetic拒否
- Production明示approval guard

## 最後のスイッチ前に必要

- 正式Production Store Sales API URL
- API deploymentとHUB Session verifier
- Accounting/Core DB Access Port
- Store Master SoTと20店舗照合
- Production read-only permission証跡
- Staging E2Eと数値照合
- Security/Accounting/Sales/Platform承認

これらが揃うまでproductionReadOnlyEnabled=falseを維持する。
