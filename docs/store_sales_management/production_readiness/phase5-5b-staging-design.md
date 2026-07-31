# Phase 5-5B Staging Design

## Scope

Stage 1 Synthetic Dataだけを使う、Production完全分離のStore Sales Staging基盤。実project作成、migration適用、deploy、本番接続は対象外。

## Architecture

Synthetic Directory → Synthetic Accounting Published Projection → Synthetic KPI Active Projection →既存Store Status/Rules境界→Staging Projection API→既存Runtime→UI。

## Environment Boundary

`local/preview/integration/staging/production`を許可し、`APP_ENV`と`RUNTIME_MODE`をtrusted configから解決する。query、localStorage、UIから変更できない。Staging/Production URL混在、Production synthetic、production block解除前起動を拒否する。

必須keyは`.env.staging.example`に名称だけを記載。Staging project ID/URLはTBD。

## Confirmed Decisions

role/scope、利益閲覧、EC非配賦、商品売上内訳、immutable version/rollback、指定ownerはPhase 5-5B指示を正とする。Runtime責務は変更しない。

## Blocking

Staging Supabase/NOV HUB/URL、secrets、environment approver、正式signature verifier、migration承認。

## Evidence

`supabase/functions/store-sales-projection/`、`portal/store-sales/staging-config.js`、[Security](phase5-5b-staging-security.md)。
