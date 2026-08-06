# Workspace Contract Release Gate

公開前に、認証済み実ブラウザで次を順番どおり確認する。

1. NOV HUBへログイン
2. 求人管理を同一Sessionで開く
3. Workspace HTTP 200
4. Contract Version一致・Validator PASS
5. Dashboard表示
6. 学生636件
7. 27卒528件
8. 28卒108件
9. 有効フェア46件
10. フェア一覧
11. フェア詳細
12. 補助失敗fixtureで「集計準備中」かつ学生一覧継続
13. Console Error 0
14. Console Warning 0

どれか1件でも不一致ならReleaseを停止する。単体テストの件数だけで公開可とは判定しない。
