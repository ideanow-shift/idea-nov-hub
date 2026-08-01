# NOV Talent v2 Release 1.0 readiness

## 判定

`CONDITIONAL PASS`。実装・固定回帰・GitHub Actions・ローカルHUB統合は公開準備済み。禁止事項に従いmerge/deployしていないため、公開HUBはまだ旧「人財投資管理システム」であり、求人管理と現職者管理が混在している。

## main追従

- 基準main: `75f6a1adfb0252fd60cd97c2662b4fc235f84ab8`
- Store Operations PR #13/#14を含む最新mainをPR Aへ統合済み。
- workflow競合はmainの明示的production承認を採用。
- PR BのHUB競合はStore OperationsとNOV Talentの両カード・両権限判定を保持。
- PR BのPR A比差分は17ファイル、392追加、27削除。Store実装の重複持込みなし。

## PR構成

- PR #15: `release/nov-talent-v2-clean-base` → `main`、Draft、mergeable、40ファイル。
- PR #16: `release/nov-talent-v2-hub-integration-clean` → PR #15 branch、Draft、mergeable、17ファイル。
- 旧PR #11/#12は新PRに置換済みのため公開候補から除外する。ただし自動closeやbranch削除はしない。

## Quality Gates

- PR A: 195/195 PASS。
- PR B: 219/219 PASS。
- main比新規Fail: 0。
- Actions: PR A run `30674420666`、PR B run `30674623804` ともsuccess。
- JavaScript構文、固定回帰、diff whitespace、secret scan、Production Mock Identity拒否がPASS。
- deploy jobは両方skipped。
- ローカル実ブラウザ: HR起動、代表取締役の個人情報制限、一般社員のカード非表示/403、未ログイン、期限切れ、モバイル、Console error/warning 0を確認済み。

## 公開HUB確認

2026-08-01に `https://ideanow-shift.github.io/idea-nov-hub/` と `/talent/` を実ブラウザ確認。未ログインHUBはログイン画面を表示し、直接Talent URLは旧UIを表示して再ログインを要求した。Console error/warningは0。新しい「求人管理 / NOV Talent」導線は未deployのため公開HUBでは未到達であり、これは現時点の唯一の公開確認ブロック。

## 残作業

1. PR #15を人間レビュー後にmerge。
2. PR #16のbaseをmainへ変更し、差分とActionsを再確認。
3. PR #16を人間レビュー後にmerge。
4. 明示承認付きworkflow_dispatchで1回deploy。
5. 公開HUBでRole別起動とConsoleを再確認。

Production、DB、Supabase、JWT、RLS、Permission Modelへの変更はない。
