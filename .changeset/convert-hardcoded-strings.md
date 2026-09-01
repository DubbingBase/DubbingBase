---
"@app/website": patch
---

fix(i18n): convert remaining hardcoded UI strings across all pages to translation keys

Converts ~730 hardcoded template strings (text nodes, interpolation
literals, and mixed nodes) in apps/website/src/pages to `$t()` calls and
adds the corresponding translations to all four locales. Covers legal
pages, voice-actor/studio/editor pages, admin tools, and public pages.
