# Environment Switch

Environment切替はRuntime configだけで行い、UI構成とProjection Contractは共通にする。

| Flag | Endpoint key | Guard |
|---|---|---|
| preview | none | localhost + explicit Mock Identity |
| integration | integrationEndpoint | localhostまたはHTTPS |
| staging | stagingEndpoint | HTTPS必須 |
| production | productionEndpoint | HTTPS + approval + Synthetic禁止 |

Query parameterやlocalStorageではEnvironmentを変更できない。Productionの最終スイッチは設定レビューを伴う別PRとし、このSprintではfalseのまま維持する。
