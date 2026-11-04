---
"@app/website": patch
---

Edge-cache anonymous renders of the movies, series, voice-actors and movie, show and voice-actor detail pages to cut Worker SSR CPU. Server HTML no longer varies by visitor: admin/user UI renders after hydration through `useClientUser`, the theme cookie is only read and written in the browser (an inline head script applies it before paint), and `Set-Cookie` is removed from cached responses. Signed-in requests are never cached. Language is decided by the URL only: the server no longer redirects `/` from `Accept-Language` or writes `user_lang`; `LanguageBanner` suggests the preferred language (explicit choice, else browser language) and the cookie is written in the browser, so the home page is cached too.
