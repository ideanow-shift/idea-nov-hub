# Core Master Audit Human Questions

|ID|質問|理由|Blocking|
|---|---|---|---|
|CMA-Q01|正式な店舗SSoTは`public.stores`と`core.stores`のどちらですか？|実レコードが20対1で並存している|Yes|
|CMA-Q02|所沢店の正式UUIDは`1285ac70...`と`ccfe77c1...`のどちらですか？|同じcodeで別UUID|Yes|
|CMA-Q03|`core.stores`は移行途中、試験用、将来正式Masterのどれですか？|用途を示すDB証跡がない|Yes|
|CMA-Q04|店舗運営法人の履歴はどのTableを正式管理先にしますか？|該当する履歴Masterがない|Yes|
|CMA-Q05|立川店の2026-06-01直営化などのeffective periodをどの粒度で保持しますか？|現schemaで表現できない|Yes|
|CMA-Q06|official_name / display_name / brand_name / search_aliasを店舗Masterへ持たせますか？|現在は単一名称列のみ|Yes|
|CMA-Q07|Direct/FCは明示属性にしますか、法人属性から導出しますか？|現在は導出のみ|Yes|
|CMA-Q08|`public.stores`のRLS policy 0件は意図したdefault denyですか？|Production read経路の承認が必要|Yes|
|CMA-Q09|RLS無効の`core.stores`にauthenticated SELECT grantがある状態を許容しますか？|API公開schemaとの組み合わせでSecurity影響|Yes|
|CMA-Q10|本部と撤退店舗を現行店舗数から除外する正式scope ruleを承認しますか？|20店舗集計の再現性に必要|No|
