# Sprint 2 Permission Scope Verification

ScopeはSynthetic Identityからserver側で解決し、request body/queryからroleやstore setを受け取らない。unknown roleはdefault deny。

| Role | server response | 結果 |
|---|---:|---|
| representative | 20 | PASS |
| sales_manager | 直営13 | PASS |
| area_manager | 担当5 | PASS |
| store_manager | 自店舗1 | PASS |
| employee/unknown | 403 | PASS |

営業部長によるFC詳細要求と店長による他店舗詳細要求は403。許可scopeの0件は200＋空配列であり、forbiddenとemptyを分離した。
