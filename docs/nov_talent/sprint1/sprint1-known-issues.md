# Sprint 1 既知課題

- Candidateの追加・編集・確認・Employee Core引継ぎはMock Runtimeでは非表示。書込み実装は将来の別承認対象。
- Event Managementは既存フェア分析と候補者詳細の履歴表示を再利用。専用イベントCRUDは未実装。
- 採用目標値とROIの予算連携はMockのため永続化しない。
- 28卒CSVはブラウザ内の形式検証まで。staging投入はSprint 1の対象外。
- 凍結した旧現職者ソースには旧API用コードが残るが、公開ナビゲーションとRuntimeから到達できない。
- CandidateからEmployee Coreへ切り替える本番ハンドオフは未実装。

これらはSprint 1のMock Runtime境界を越えるため、欠陥として隠さず次Sprint候補として管理する。
