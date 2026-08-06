# Design Token仕様

## 既存Tokenを正本として使用

| 用途 | Token | 値 |
| --- | --- | --- |
| 背景 | `--bg-primary` / `--bg-secondary` | `#FFFFFF` / `#FAFAFA` |
| 文字 | `--text-primary` / `--text-secondary` | `#1F1F1F` / `#767676` |
| Brand | `--color-bassa` | `#E8B4B8` |
| Error / Success | `--color-alert` / `--color-success` | `#FF3B30` / `#34C759` |
| Border | `--border-light` / `--border-soft` | `#E5E5E5` / `#F0DFE1` |
| 間隔 | `--spacing-xs/sm/md/lg/xl` | `4/8/12/16/24px` |
| 角丸 | `--radius-sm/md` | `6/8px` |
| 操作高 | `--control-min-height` | `44px` |
| Card shadow | `--shadow-card` | `0 8px 24px rgba(31,31,31,.04)` |
| Focus | `--focus-ring` | `0 0 0 3px rgba(232,180,184,.45)` |

fontは既存system font、base 14px。Caption 12px/1.5、body 14px/1.55、section title 22px/1.3、page title `clamp(28px,4vw,42px)`を維持する。

## 本画面の暫定Token（Design System昇格候補）

| Token候補 | 値 | 用途 |
| --- | --- | --- |
| `--content-max` | `1480px` | shell最大幅 |
| `--page-gutter-desktop/tablet/mobile` | `32/18/12px` | 横余白 |
| `--section-gap-desktop/mobile` | `40/32px` | 第一階層section間 |
| `--card-radius-lg` | `12px` | KPI・Action・Detail card |
| `--summary-radius` | `16px` | Summary hero |
| `--table-row-height` | `56px` | PC一覧 |
| `--sticky-offset` | HUB headerの実測値 | filter上端。固定値の重複禁止 |

暫定TokenはStore Operations内のlocal custom propertyとして一か所に定義し、componentへ数値を直書きしない。NOVA Design System採用時にaliasを差し替える。

## 状態色

好調、安定、改善中、要対応は既存status tokenを使用し、必ず文字labelとdot/iconを併用する。新しい意味色を追加しない。Chartの今年はBrand濃色、前年は`#777777`の破線。本文contrast 4.5:1、large text／graphic 3:1を下回らない。
