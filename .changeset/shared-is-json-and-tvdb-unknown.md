---
"@app/shared-logic": patch
"@app/website": patch
---

Add an `isJson` narrowing helper to `@app/shared-logic` and replace its four local copies. The TVDB client's `get()` now returns `unknown` instead of an implicit `any`, and the media service reads character lists from it with `readPath`.
