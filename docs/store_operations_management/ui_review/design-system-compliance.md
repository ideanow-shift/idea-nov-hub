# IDEA NOV Design System準拠

## 採用

`portal/css/design-system.css`の背景、文字、Brand、Border、spacing、radius、control height、shadow、focus ring、typographyを正本として採用する。Store Operations固有CSSは正本tokenをalias参照し、同義の色やspacingを再定義しない。

## 既存のまま使うComponent pattern

44px control、focus-visible、status label＋色、subtle card、system font、12px caption、明確なheading hierarchyを維持する。英語eyebrow、日本語見出しの重複、強いgradient、過剰shadow、装飾iconの乱用は採用しない。

## Store Operations内で暫定運用

content最大幅、section gap、large card radius、table row height、sticky offsetは共有Design Systemに正式tokenがないため、[design-tokens.md](design-tokens.md)のlocal aliasを使う。複数画面で再利用が確認できた時点でNOVA Design Systemへ昇格候補として提出する。

## 新規共通化候補

StatePanel、StatusBadge、MetricTile、FilterBar、Responsive Data List、Shared Trend Chartは他業務アプリでも再利用可能。ただし本SprintではDesign System本体を変更せず、Store Operations内の同一仕様として実装する。

## 適合確認

- 320、620、768、1024、1366、1440、1920pxでoverflowとheading hierarchyを確認
- keyboard focus、contrast、reduced motion、touch targetを確認
- 色・余白・radiusの直書きがlocal token定義以外にないことを確認
- ProductionでPreview固有部品がDOMに出ないことを確認

