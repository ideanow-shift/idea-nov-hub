# Read-only運用規程

## 接続と権限

Production read-only監査Roleは一回の承認実行のためだけに作成する。既存資格情報、`service_role`、アプリケーションRoleを流用しない。Roleは`NOINHERIT`、接続上限1、期限付きとし、Q01/Q02/Q08で確認済みのprojectionにだけ`SELECT`を与える。

## 禁止権限

INSERT、UPDATE、DELETE、TRUNCATE、DDL、RPC/EXECUTE、CREATE、ALTER、DROP、ownership、replication、BYPASSRLS、superuser、default privileges、任意schema/table/functionへのアクセスを禁止する。

## 実行制限

最大3 Query、各Query 1回、retry 0、statement timeout 5秒、lock timeout 1秒、同時接続1とする。開始後は必ず`BEGIN READ ONLY`、終了時は成否にかかわらずROLLBACKと接続closeを確認する。

## 資格情報

資格情報は承認済みpassword managerの時間制限共有のみで渡す。チャット、メール、GitHub、ファイル、ログ、clipboard historyへの保存を禁止する。終了後直ちに無効化し、共有を解除する。
