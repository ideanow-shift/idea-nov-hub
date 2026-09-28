# Current App Launch Flow

## カード供給

backendは`public.portal_apps`を読み、role level、tag、department、positionでfilterします。取得できない場合は固定fallbackを返します。frontendにもdemo/fallback定義があり、Management、Talent、Education、IDEA LINK等にはURL overrideがあります。

このため表示名・URL・公開状態の正本が、DB row、backend fallback、frontend overrideの三層に分かれます。2026-07-17のread-only記録はありますが、現在のライブ値は未確認です。

## 一般起動

一般アプリは新規tabを開き、`hub_context` queryを追加します。contextはBase64URLであり署名ではありません。employee UUID、Firebase UID、email、corporation、store assignments、roles、permissions等を含み、12時間`sessionStorage`と`localStorage`にも保存されます。

`hub_context`は表示補助としては使えますが、actorまたは認可の根拠にはできません。

## 特別起動

- Management / Master Admin: 同一tab。Firebase tokenまたはHUB sessionとcontextをbrowser storageへ準備。
- Shift: 同一tab。`hub_context`付き。
- NOV Talent: HUB sessionを更新し、同一tab。
- IDEA LINK: 60秒opaque codeをURLへ付け、交換後にapp audienceの15分sessionを`sessionStorage`へ保存。codeは交換後`history.replaceState`で除去。
- Education: local pathへoverride後、一般起動。

## 判定

IDEA LINKはPhase 6方式に最も近い既存例ですが、HttpOnly Cookie、非対称署名、revocation、標準auditは未実装です。一般起動はlegacy compatibilityとして残し、flag対象だけ新handoffへ分岐するのが最小変更です。
