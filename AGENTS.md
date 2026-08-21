# Repository Agent Instructions

## Portfolio Execution Order Lock

Repository内で作業するCODEXおよびその他のAI agentは、作業開始時に必ず次を実行すること。

1. `docs/cto/PORTFOLIO_PRIORITY_LOCK.md` を読む。
2. `LOCK_ID` を報告する。
3. `CURRENT_PHASE` を報告する。
4. 固定実行順序を報告する。
5. 今回の作業が `CURRENT_PHASE` に属するか確認する。
6. 属さない場合は、Priority LockにOwner承認済みの明示例外があるか確認する。例外の
   ALLOWED範囲内だけ作業でき、PROHIBITED範囲へ拡張してはならない。明示例外がなければ
   変更せず停止する。
7. Owner以外はPhaseを変更できない。

作業開始時の最低限の報告形式は次のとおり。

```text
PORTFOLIO LOCK ID:
CURRENT PHASE:
REQUESTED WORK PHASE:
WORK ALLOWED: YES / NO
```

AI、CTO、CODEX、開発担当者は、技術判断、過去文書、新しい問題または改善提案だけを理由として固定実行順序を変更してはならない。Phase変更は、Ownerの明示承認を記録した `[OWNER PHASE TRANSITION]` PRのMergeによってのみ有効になる。Portfolio Priority自体の変更には、Ownerの明示指示を記録した `[OWNER PRIORITY CHANGE]` PRのMergeが必要である。

Owner承認済み例外はPhase Transitionではない。例外がStore Operationsと競合する場合は
例外側を停止し、CURRENT_PHASEを優先する。
