# Recruiting Target Contract 1.0.0

Phase 1 の正式対象は、卒業年度別・全社 Scope の `OFFERED` と `OFFER_ACCEPTED` だけです。目標値は0以上の正式値で、NULLや推測値を保存しません。

## 正本境界

- 論理キー: `graduation_year + target_type + target_period_code + scope_type`
- 承認済み Target は直接更新・削除しません。
- 改定は新しい DRAFT version を作成し、承認時に旧 APPROVED を SUPERSEDED、新versionを APPROVED へ同一transactionで遷移します。
- 達成実績は Selection History の該当正式Factへ到達した unique Candidate の累積人数です。後続の WITHDRAWN 等で過去の正式到達を取り消しません。
- Candidate Projection、Source Evidence、Fair Attribution は目標実績に使用しません。
- `EXPECTED_JOIN`、`STORE`、`JOB_TYPE` は Phase 1 対象外です。

## API

- `POST /api/talent/v1/recruiting-targets/drafts`
- `GET /api/talent/v1/recruiting-targets/drafts`
- `POST /api/talent/v1/recruiting-targets/versions`
- `POST /api/talent/v1/recruiting-targets/{targetId}/approve`
- `POST /api/talent/v1/recruiting-targets/{targetId}/supersede`
- `GET /api/talent/v1/recruiting-targets/current`
- `GET /api/talent/v1/recruiting-targets/history`

Actor と Role は HUB Session から server-side で解決します。Browserからのtable DMLは禁止し、書込みはdefault-off flagとservice-role限定RPCを通します。

Outcome 3 Contract 1.0.0 の Target は引き続き UNSET です。本Foundationとの接続は Outcome 3 Contract 1.1.0 の別Gateで行います。
