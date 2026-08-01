# Phase 5-3 Preview Security

## Safety

- localhost mock mode限定、外部API通信なし
- production adapterは起動拒否
- canonical NOV HUB sessionを再利用
- Store Sales独自ログイン、service role、実会計ファイル、実個人情報なし
- fixture選択を一般actor向けUIやrole queryへ公開しない
- card非表示だけに依存せず、直接URLでもsession/contextを検証
- logout時にsessionとPreview contextを破棄
- Access Denied／Session Expiredでは業務画面を非表示
- textContent中心のDOM描画、token・金額・raw responseのconsole出力なし

Preview contextはlocalhostでsynthetic fixtureを選ぶためだけの情報であり、認可証跡ではない。本番では利用禁止とし、server-side actor contextが確定したProjection responseへ置換する。

## Fixture bundle risk

mock fixtureが配布物に残ると、サンプルを実データと誤認するリスクがある。現段階はbannerとproduction起動拒否で遮断する。本番buildではmock adapter、review fixture、preview context、screenshot fixtureを別entryまたはbuild flagで除外し、production CIで含有検査する。

## Negative tests

対象外actorのカード非表示、employee denied、session missing/expired、logout後context破棄、production拒否、外部fetchなし、service roleなし、相対URL、role queryなし、業務画面遮断、既存scope越境検査を確認する。

