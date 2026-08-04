# 最終Visual Guideline

## Layout

content最大幅1480px、中央配置。gutterはPC 32px、Tablet 18px、Mobile 12px。第一階層section間40px、Mobile 32px。Card gap 12px、内部paddingはPC 20–24px、Mobile 16px。Border 1px、shadowは階層差が必要なcardだけに限定する。

BreakpointsはDesktop 1024px以上、Tablet 621–1023px、Mobile 620px以下。Decision SignalはDesktop 3列、Tablet 2列、Mobile 560px以下1列。Priorityは1440px以上3列、1024–1439px 2列、1023px以下1列。店舗一覧は1024px以上table、それ未満card。

## Hierarchy

ページtitle→section title→結論→主数値→比較→注記の順。英語eyebrowの重複見出しは禁止。説明文は原則2行、Priority本文は3行以内。数値はtabular numeralを推奨し、単位と対象期間を常に近接させる。

## Density

PC table rowは56px、header 44px。SummaryはPC 208–232pxを目安、Priority card 240px、Decision Signal card 236–250px。初期viewportの達成を優先し、装飾的な余白でsection開始を押し下げない。Sticky filterはHUB header直下、box shadowではなくborderで境界を示す。

## Responsive

Mobileは1column、filterはbottom sheet、一覧はcard、Detail tabだけ横方向scroll可。本文・table・page全体の横scrollは禁止。Chartはaspect ratioを保ち、labelが衝突する場合はtickを間引く。Mobile accordionは見出しbutton全体44px以上、初期展開は最重要sectionひとつだけ。

## Accessibility

色だけで状態を伝えない。Focus ringを消さない。Text contrast 4.5:1。Chart、bar、statusは同等のtextを持つ。Touch target 44px。Heading levelを飛ばさない。Loading／更新完了は必要な範囲だけlive announceする。

