# Remaining Blockers

未検証domainは次の5件です。

1. trusted certificate付きHTTPS originでのreal browser / Cookie検証。
2. productionと分離したcanary issuer・exchange・session endpoint。
3. 複数instance共有のdistributed atomic store。
4. retention・masking・tamper protection付きpersistent audit。
5. server-side feature flag、propagation、stale cache、rollback rehearsal。

## CTO Decision Items

- 既存の安全なstaging projectを指定するか、新規費用を承認するか。
- DNS/certificate、store、audit、Secret managerのowner。
- retention期間とaudit閲覧権限。
- test window、incident owner、rollback owner。

これらの入力なしにproduction資源を代用しません。
