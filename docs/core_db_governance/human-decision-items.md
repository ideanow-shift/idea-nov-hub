# Core DB Governance Human Decision Items

実装開始前に人間が決定・承認する事項のみを記載する。

1. Core Master Owner、Platform Owner、Security Owner、Accounting Owner、Sales Owner、CTOは、`public.stores`の既存UUIDを継承する論理SSoTを承認するか。
2. Core Master OwnerとSales Ownerは、`public.stores`と`core.stores`の所沢店が同一実店舗であることを正式証跡で承認できるか。
3. `core.stores`のownerと既存consumerは誰で、新規書込み停止・将来retireの責任者は誰か。
4. Representative、Executiveの正式role keyと、Executiveのscopeはall groupかassigned departmentsか。
5. Employeeに許可するStore Directoryの最小属性は何か。Store Salesはdenyのままでよいか。
6. 正式Constitution本文の保管場所と承認versionは何か。本ADRとの条項単位レビュー担当者は誰か。
7. Core Master Access Portとversion付きDB contractのowner・SLA・監査sinkは誰が持つか。
8. 運営主体移管のeffective dateを誰が起案・承認し、Accounting確定済み期間への遡及影響を誰が承認するか。
9. Store Master変更のseparation of duties、Production実行者、rollback decision ownerを誰にするか。
10. official name、display name、brand name、store noの初期値と証跡をEntity Approval Boardで誰が最終承認するか。
