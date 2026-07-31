# Store Master Verification

## 結果

**BLOCKED**

既存監査では\`public.stores\`上の現行20店舗集合とDirect 13 / FC 7は一致している。一方でProduction接続の正式性は未確定。

## 一致した範囲

- 現行店舗20
- Direct 13
- FC 7
- 本部1とinactive 1を対象外にできる候補
- UI上の正式表示名20件

## Blocking

- \`public.stores\`と\`core.stores\`のSoT未決定
- 所沢店の二重UUID
- Production read-only経路とRLS方針未承認
- 運営法人履歴/effective period未整備
- official/display/brand/aliasの正式属性未確定
- 20件すべてのCore UUID・store code照合が未完了

所沢UUID、DBレコード、schema、aliasは変更していない。実UUIDをUIへ露出していない。
