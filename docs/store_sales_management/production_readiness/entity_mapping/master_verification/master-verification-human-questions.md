# Master Verification Human Questions

重要度順。いずれも自動修正せず、人間の回答と証跡を記録する。

|question_id|対象Entity|確認理由|影響範囲|推奨回答形式|Blocking|
|---|---|---|---|---|---|
|HQ-001|全20店舗|Core実レコード・UUID・店舗コード・法人FKが未確認|全Mapping|read-only exportの取得日時・query・対象列・20行|Yes|
|HQ-010|久米川店|Google open dateが`197703/12`|open_date・履歴|正しい日付または年月精度と証跡|Yes|
|HQ-006|立川店|BIOEL→IDEA NOVの月次境界をCoreで未確認|法人履歴・会計期間|終了日2026-05-31／開始日2026-06-01の承認|Yes|
|HQ-007|新所沢・久米川・国分寺・花小金井・東久留米|直営→FCを同一store entityとして保持する必要|重複防止・期間|同一entity可否、切替日、旧期間のstatus|Yes|
|HQ-004|野方店|ALBERO→IDEA NOV直営化履歴がGoogleに存在|法人履歴|2024-03-01開始の承認とCore履歴ID|Yes|
|HQ-003|ANNEX店|BASSAANNEX店・アネックス・ANNEXが併存|名称・検索|official/display/brand/aliasの4区分|Yes|
|HQ-009|Roane by Bassa|BASSA表記、大小文字、ロアネが併存|名称・検索|official=`Roane by Bassa`とalias一覧|Yes|
|HQ-005|KYARA HALF店|Google表示はKYARA HALF池袋|名称・location|official/display/location aliasの区分|Yes|
|HQ-008|鷺ノ宮店|GoogleではALBERO新規開店|effective period|2021-06-01を開始日として承認可能か|Yes|
|HQ-002|東大和店|Google open dateが月精度のみ|open_date|日付不明のまま年月精度で保持するか|No|
|HQ-011|本部|Googleにstore形式の本部行がある|entity type|head_office / department / accounting sourceの選択|Yes|
|HQ-012|法人名称|IDEA NOV表記と株式会社イディア・ノブ表記|legal entity|正式法人名とCore corporation UUID|Yes|
