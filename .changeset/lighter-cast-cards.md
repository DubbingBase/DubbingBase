---
"@app/website": patch
---

Render 24 cast cards per page instead of 48, use plain `<img>` elements for card and poster images (the image module only passed these URLs through unchanged), and resolve card labels and profile links once per render instead of once per card, to cut server render CPU on media pages.
