# hub-context-test canary

Production bundleから分離されたsynthetic/read-only診断実装です。既存NOV HUBへimport・配線されておらず、flag既定値はすべてOFF、kill switchはONです。

`handoff-canary.mjs`はissuer、one-time store、actor resolver、exchange、app session、auditのcontractを提供します。storeとauditはmemory mockであり、外部serviceやproduction dataを使いません。

`index.html`は許可された診断項目だけをDOM `textContent`で表示し、queryを直ちに除去します。
