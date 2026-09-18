# Rollback Plan

## 現在

canaryは既存`main.js`へ配線されず、全flag OFF、kill switch ONです。現行動作へのrollbackは不要です。

## 将来のreview環境

1. kill switchをON。
2. app flagをOFF。
3. global flagをOFF。
4. 未交換codeをrevoke。
5. app sessionをrevoke。
6. canary routeを診断拒否画面へ戻す。
7. auditで`kill_switch_used`と`fallback_used`を確認。

既存業務appは常にlegacy launchを維持します。DB rollback、migration rollback、既存app再deployを必要としない配線をPhase 9の条件にします。
