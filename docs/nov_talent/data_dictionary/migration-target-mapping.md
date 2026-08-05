# Migration先区分

1行からCandidateと複数の履歴候補を生成できる。ただし、Candidate同一性が確定しない履歴を自動関連付けしない。

## A. Candidate

本人の正本属性を扱う。

- 氏名・氏名カナ
- 学校・学部
- 卒年
- 電話・email・LINE識別子

`exact_match` は既存Candidateへ関連付ける。`no_match` は氏名と学校の最低識別条件を満たす場合だけ新規Candidate候補とする。

## B. Event / Contact

接触、説明会、見学、面接等の事実を扱う。

- event name・date・status
- Source type・label
- follow up・next action date

Candidateが確定し、イベントコードと日付が辞書契約を満たす場合だけ履歴候補を生成する。

## C. Selection History

応募、選考、内定、辞退、不採用の状態履歴を扱う。

- entry status
- selection status
- offer status
- withdrawal
- rejection
- status changed at

未知状態・未知理由を推測変換しない。不採用理由は現行辞書で未定義のため、値がある場合は正式コード定義までQuarantineとする。

## D. Quarantine

次の行はQuarantineへ送る。

- Candidateを特定できない
- 必須識別キーが不足
- 複数Candidate候補
- Source矛盾
- 不正または未定義の状態
- 対応不能な重複

`probable_match`、`ambiguous`、`conflict` はHuman Review対象であり、自動統合しない。自動削除も禁止する。
