# Identity Mapping Review

## 現状

`public.employees` は `id`, `employee_id`, `firebase_uid`, `auth_email`, `email` を持ち、`core.employees` は別 `id`, `employee_code`, `firebase_uid`, `email` を持つ。`public.employee_login_credentials.employee_id` は public employeesを参照する。コードにはFirebase UID、JWT employee ID、email/bootstrapの複数経路が存在する。

## 推奨一意契約

`verified Firebase sub -> identity link -> canonical employee UUID`

- Firebase UIDは有効な1 employeeに最大1件。
- canonical employee UUIDは認可・監査のactor key。
- employee code/emailは検索・表示属性であり認証主キーではない。
- public/core ID対応はversion付きmappingで表し、推測変換しない。
- 退職、再入社、account移管、email変更を状態遷移として扱う。

## SELECT-only確認項目

1. UIDのNULL、空、重複、同一UIDのpublic/core不一致。
2. email/auth_emailの正規化後重複、共有address、大小文字。
3. login credentialsの孤立、inactive/retired employee参照。
4. public/core間でcode/email/UIDが一意対応しない行。
5. employee roles/store assignmentsの孤立と期限切れ。
6. token claim employee IDとUID解決結果の不一致。

## 判定

ライブ重複件数が未取得のため、mappingの完全性は **Blocked**。重複時に最初の1件を採用せず認証を拒否し、correlation IDだけを返して管理者レビューへ送る。email fallbackは期限付き移行機能とし、通常認証経路から外す。
