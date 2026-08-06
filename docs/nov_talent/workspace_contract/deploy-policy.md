# Workspace Contract Deploy Policy

公開順は次で固定し、逆順を禁止する。

1. `legacy-v0-read`を備えた後方互換FrontendをPagesへ公開
2. v1レスポンスを返すStaging Edge Functionを公開
3. 実ブラウザRelease Gate合格後にWorkspace Contract Versionをv1へ固定
4. 監視期間終了後、別PRで旧Version互換を削除

各段階で、Pages metadata・runtime config・生成Edge定数のVersion一致を確認する。段階間で不一致、Validator FAIL、Candidate件数不一致があれば次段階へ進まない。DB、Migration、RLS、Productionは本手順の対象外である。
