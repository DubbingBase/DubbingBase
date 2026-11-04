---
"@app/website": patch
---

Replace legacy `any` and type assertions in ten API handlers (dashboard stats, trending media preparation, social content, user profile/voice-actor/subscription/report routes) with generated Supabase types and narrowing, without changing their responses.
