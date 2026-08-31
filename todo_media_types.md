# Media Types Roadmap & Public API Integrations (Advertisement & Toy)

This document tracks upcoming integrations, public/custom API architectures, and metadata enrichment for media types that currently lack dedicated 3rd-party public API providers.

---

## 📺 1. Advertisements & Commercial Spots (`advertisement`)

Currently, commercial spots rely solely on internal database records with no 3rd-party public metadata API.

### 🎯 Objectives & Integrations:

- [ ] **Public Metadata Providers & Scrapers:**
  - [ ] Investigate integration with public commercial archives (e.g., YouTube Data API / Brand Channels, AdForum, iSpot.tv, INA Publicité for French archives).
  - [ ] Support video embeds (`youtube_video_id` / direct video URL) for playing the original commercial directly in the media view.
- [ ] **Data Model & Schema Enrichment:**
  - [ ] Brand & Advertiser relationships (linking brands to parent companies and advertising agencies).
  - [ ] Campaign year, country/region, and product category tagging (e.g., _Automotive_, _Food & Beverage_, _Tech_, _Luxury_).
  - [ ] Voice type categorization (e.g., _Voice-Over / Off-screen narrator_, _Spokesperson_, _Character dub_).
- [ ] **Admin & Community Management:**
  - [ ] Dedicated creation modal in `/admin` with autocomplete for brands and studios.
  - [ ] Community submission flow for identifying voices in popular TV/radio commercials.

---

## 🧸 2. Connected Toys & Interactive Storytellers (`toy`)

Currently, smart audio toys and storytellers (e.g., Lunii, Tonies, VTech, Bookinou) are stored as local database records without an external catalog API.

### 🎯 Objectives & Integrations:

- [ ] **Catalog Metadata Providers & Scrapers:**
  - [ ] Investigate scraping/cataloging from official public stores:
    - [ ] **Lunii (Fabrique à Histoires)**: Story catalog, author/narrator credits, cover art, age range.
    - [ ] **Tonies (Toniebox)**: Figurine names, audio content length, licensed franchises (Disney, Marvel, etc.).
    - [ ] **Bookinou / VTech (Storio, Genio, MagiBook)**: Interactive books, audio tracks.
  - [ ] Wikidata / MusicBrainz / OpenLibrary cross-referencing for audio story adaptations.
- [ ] **Data Model & Schema Enrichment:**
  - [ ] Manufacturer / Device ecosystem tagging (`Lunii`, `Tonies`, `VTech`, `Bookinou`, etc.).
  - [ ] Story tracks & episodes breakdown per cartridge/figurine/pack.
  - [ ] Age group recommendations and franchise links.
- [ ] **UI & Discovery:**
  - [ ] Dedicated toy discovery and filtering by device platform on the website and mobile app.
  - [ ] Visual badge indicators for toy platforms (e.g., Lunii logo, Tonies figurine icon).
