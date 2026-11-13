---
"@app/website": patch
---

Cut the Worker server bundle by about a third (5.6 MB to 3.7 MB of JavaScript, 1.6 MB to 0.9 MB gzipped): tree-shake lucide-vue-next instead of bundling its 575 KB CommonJS build, bundle a single copy of the Supabase client instead of two, serve the OG-image fonts as static assets through the ASSETS binding instead of embedding them, and drop the OG route's satori fallback that could only produce an empty image.
