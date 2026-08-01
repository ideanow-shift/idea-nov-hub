# Sprint 3 Known Issues

1. 正式Staging環境のURL、Project、Secret、JWTが未確定。推測接続は行わない。
2. 全repository testは455件中440 PASS、15 FAIL。15件はSprint 3開始前から存在するStore Operations外の既知失敗で、新規Failは0件。
3. Local IntegrationはSynthetic Data専用で、数値妥当性・会計照合のレビューには使用できない。
4. Virtual Scrollは未導入。実データで数百店舗を表示する段階で端末計測後に再評価する。
