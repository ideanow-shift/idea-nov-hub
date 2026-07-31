# Core Master Audit Summary

## 判定

**BLOCKED**

## 理由

- `public.stores`には承認済20店舗が過不足なく存在する。
- ただし`core.stores`が別UUID体系で並存し、所沢店が重複している。
- 店舗運営主体履歴とeffective periodを保持するMasterがない。
- `public.stores`はRLS enabledだがpolicy 0件。
- `core.stores`はRLS disabledかつauthenticated SELECT grantあり。
- official/display/alias、Direct/FCを正式属性として保持していない。

## 監査数値

- 店舗Master実体候補: `public.stores`
- 全レコード: 22
- 現行店舗: 20
- Direct / FC: 13 / 7
- 本部: 1
- inactive: 1
- 承認済20店舗との差分: 不足0、余剰0
- UUID確認: public 22件、core 1件
- Store Code確認: public 22/22
- 店舗履歴: 未整備

## 次に行うべき作業

1. Architecture Reviewで`public.stores`と`core.stores`の正式SSoTを決定する。
2. 所沢店の二重UUIDを人間承認で解決する方針を決める。
3. 店舗運営法人の履歴・effective periodモデルを設計レビューする。
4. official/display/brand/alias、Direct/FC、statusの正式属性方針を承認する。
5. RLSとProjection APIからのread-onlyアクセス方針をSecurity Reviewする。

本監査は変更を提案するだけであり、実装・migration・データ修正は別フェーズとする。
