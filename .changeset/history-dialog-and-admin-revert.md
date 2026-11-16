---
"@app/website": minor
"@app/supabase": minor
---

Show the change history in a dialog opened from a History button in the hero action bar of voice actor and studio pages. Entries are grouped by day with filters (All, Important, Cast credits, Profile), kind badges, highlighted important fields, before/after diffs with image thumbnails, and deep links (TMDB, Wikidata, websites, social links, pictures, and the media a cast credit belongs to). Admins get a quick two-step revert for profile edits, studio edits, cast credit creation and credit performance changes; it refuses when a later edit changed the same fields, runs through the existing audited RPCs, and marks the original entry as reverted.
