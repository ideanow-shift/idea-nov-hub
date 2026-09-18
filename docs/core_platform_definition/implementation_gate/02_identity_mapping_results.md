# 02 Identity Mapping Results

検証は個人のUID・email値を出力せず、件数だけをSELECT集計した。

## public.employees

| 項目 | 件数 |
| --- | ---: |
| 全employee | 775 |
| active | 190 |
| inactive | 585 |
| retired_onあり | 326 |
| firebase_uid NULL | 769 |
| firebase_uid空欄 | 0 |
| firebase_uid重複group / 行 | 0 / 0 |
| activeでUIDなし | 184 |
| email NULL / 空欄 | 684 / 5 |
| email重複group | 0 |
| auth_email NULL / 空欄 | 744 / 0 |
| auth_email重複group | 0 |
| email/auth_email横断の別employee重複 | 0 |
| activeでemail/auth_email双方なし | 104 |

UIDが設定されたemployeeは6件に過ぎない。重複はないが、Firebase UIDを標準identity linkとして即時必須化できる充足率ではない。email fallbackもactive 190人中104人では利用不能である。

## 関連テーブル

| 検査 | 件数 |
| --- | ---: |
| employee_login_credentials | 82 |
| credential→employee孤立 | 0 |
| inactive employeeのcredential | 0 |
| retired employeeのcredential | 0 |
| employee_roles→employee孤立 | 0 |
| employee_roles→role孤立 | 0 |
| store assignment→employee孤立 | 0 |
| store assignment→store孤立 | 0 |
| active roleがinactive employeeを参照 | 0 |
| active assignmentがinactive employeeを参照 | 257 |
| handoff→employee孤立 | 0 |
| handoffがinactive employeeを参照 | 0 |

active assignment 456件中257件がinactive employeeを参照する。物理孤立ではないが、`assignment.is_active` だけで店舗scopeを解決すると退職・無効employeeへscopeを残すため、employee active/retired判定を必ず併用する。

## public / core対応

| 対象 | core件数 | publicに対応なし |
| --- | ---: | ---: |
| employees | 1 | 0 |
| stores | 1 | 0 |
| corporations | 1 | 1 |

employeesはUID/email/code、storesはcodeとpublicのstore ID/noで候補照合した。corporationはcore codeとpublic corporation code/noが一致しない。件数が各1件のため、coreを正本として採用する実データ根拠はない。

## Core候補の品質

| 検査 | 件数 |
| --- | ---: |
| employee_id重複group | 0 |
| store_id重複group | 0 |
| corporation_code重複group | 0 |
| employee→store FK孤立 | 0 |
| employee→corporation FK孤立 | 0 |
| store→corporation FK孤立 | 0 |
| employee corporation_id NULL | 300 |
| employee primary store_id NULL | 329 |
| store corporation_id NULL | 0 |
| active/inactive stores | 21 / 1 |
| active/inactive corporations | 6 / 0 |

## token employee IDとUID

ライブtoken本文は保存・取得せず、handoff表にはemployee IDのみでUID claimがないため、実tokenとの不一致件数は **未測定**。handoffのemployee孤立・inactive参照は0件。検証環境でtoken `sub`→UID解決とsession `employee_id`を同時記録したnegative testが必要。

## 判定

public 3表を当面の物理正本候補とする準備は可能。ただしIdentity認証正本としての承認は、active 184人のUID欠損、104人のemail系欠損、inactive employeeに残る257 active assignmentを解決するまで条件付きである。

