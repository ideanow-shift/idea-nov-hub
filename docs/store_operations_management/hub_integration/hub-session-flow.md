# HUB Session Flow

1. The employee signs in only to NOV HUB.
2. NOV HUB filters the App Registry using employee status, level, and role tags.
3. Selecting `店舗営業管理` confirms a valid canonical HUB session.
4. Preview stores a short-lived, non-secret actor context containing only the approved synthetic fixture mapping.
5. Navigation uses the same-origin relative route `./store-sales/index.html` in the same tab.
6. Store Operations restores the HUB session. Preview creates Mock Identity only when the HUB launch context exists.
7. Role determines the initial scope: representative=all, sales manager=13 direct stores, area manager=assigned stores, store manager=self.
8. Missing/expired session shows the HUB return instruction. A valid session without application context is forbidden.
9. The `NOV HUBへ戻る` link and browser Back return to the HUB; Store Operations has no login UI.

Tokens are never placed in the URL, application body, logs, or Preview context.
