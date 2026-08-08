# Known Issues

1. 公開artifactがmain HEADを含まず、Store Operations URLは404。
2. mainのRuntime configはPreviewでありProduction Real Data用ではない。
3. Production adapterは意図どおり\`PRODUCTION_NOT_APPROVED\`。
4. 正式Store Sales API endpoint、deployment service、audit sinkが未確定。
5. Accounting確定値Sourceと\`confirmed_through_period\`が未確定。
6. KPI、EC、予算、前年比、推移の正本が未確定。
7. Store Master SoT、所沢UUID、effective period、aliasが未確定。
8. Production read-only権限とHUB Session/API認証連携が未検証。
9. Production数値照合は未実施。
10. Draft PR #10のQuality Gatesは旧grep正規表現による既知のFalse Positiveで赤表示。mainでは修正済みだが、PR #10のhead/baseは修正commitを含まない。

いずれもProduction遮断を解除して回避しない。
