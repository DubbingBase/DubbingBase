# @app/locales

## 0.1.0

### Minor Changes

- 636bcda: Add full support for audiobooks, podcasts, advertisements, and connected toys

  - Added database migrations for `audiobook`, `advertisement`, `podcast`, and `toy` content types
  - Integrated OpenLibrary API for audiobook narrations, covers, and details
  - Integrated Apple Podcasts / iTunes API for podcast fictions, episodes, and RSS feeds
  - Added advertisement spot and connected toy metadata resolvers and video/device embeds
  - Added web detail & edit pages (`/audiobook`, `/podcast`, `/advertisement`, `/toy`)
  - Added mobile details views and routing for all new media types
  - Integrated multi-search across all media families with unified scoring
  - Added full translations in English, French, Spanish, and Japanese

- 9aa7848: Add support for viewing single seasons and episodes for TV shows

  - New composables: `useSeasonData` and `useEpisodeData` in shared-logic
  - New pages: Season view (`/show/:id/season/:seasonNumber`) and Episode view (`/show/:id/season/:seasonNumber/episode/:episodeNumber`)
  - Enhanced show page with Seasons section linking to individual seasons
  - Added translations for seasons/episodes in all locales (en, fr, es, ja)
  - Uses existing API endpoints (`/api/season`, `/api/episode`)

## 0.0.49

### Patch Changes

- b966023: Add missing translations for admin pages (queue, audit logs, reports, studios), contribute, dubbing, report modal, settings, profile, and other UI sections across all locales (en, fr, es, ja)

## 0.0.48

### Patch Changes

- ccac106: update about page content and simplify external database attribution strings

## 0.0.47

### Patch Changes

- 96c2d3d: migrate data fetching to useAsyncData across app pages and components

## 0.0.46

### Patch Changes

- 7781f71: update task enrichment logic and add support for flexible task categories

## 0.0.45

### Patch Changes

- bump

## 0.0.44

### Patch Changes

- af640a5: add comprehensive video game support including database schema updates, backend integration, and dedicated game UI components.

## 0.0.43

### Patch Changes

- da720e4: modernize header UI, reorganize navigation, and remove redundant admin layouts

## 0.0.42

### Patch Changes

- add voice actor subscription

## 0.0.41

### Patch Changes

- b374bdf: qs

## 0.0.40

### Patch Changes

- cee846b: notifications

## 0.0.39

### Patch Changes

- c45f275: bump

## 0.0.38

### Patch Changes

- 5e7fbe5: fix build

## 0.0.37

### Patch Changes

- e29719d: sd

## 0.0.36

### Patch Changes

- sd

## 0.0.35

### Patch Changes

- sd

## 0.0.34

### Patch Changes

- dh

## 0.0.33

### Patch Changes

- uodzte

## 0.0.32

### Patch Changes

- hs

## 0.0.31

### Patch Changes

- sds

## 0.0.30

### Patch Changes

- sd

## 0.0.29

### Patch Changes

- df

## 0.0.28

### Patch Changes

- sd

## 0.0.27

### Patch Changes

- bump

## 0.0.26

### Patch Changes

- initialize landing app and implement shared logic for home dashboard data fetching

## 0.0.25

### Patch Changes

- sd

## 0.0.24

### Patch Changes

- sd

## 0.0.23

### Patch Changes

- df

## 0.0.22

### Patch Changes

- sd

## 0.0.21

### Patch Changes

- sd

## 0.0.20

### Patch Changes

- sd

## 0.0.19

### Patch Changes

- jd

## 0.0.18

### Patch Changes

- bhh

## 0.0.17

### Patch Changes

- sd
- jf

## 0.0.16

### Patch Changes

- sd

## 0.0.15

### Patch Changes

- dc

## 0.0.14

### Patch Changes

- sd

## 0.0.13

### Patch Changes

- df

## 0.0.12

### Patch Changes

- df

## 0.0.11

### Patch Changes

- sd

## 0.0.10

### Patch Changes

- swd

## 0.0.9

### Patch Changes

- sd

## 0.0.8

### Patch Changes

- sd

## 0.0.7

### Patch Changes

- df

## 0.0.6

### Patch Changes

- sd

## 0.0.5

### Patch Changes

- 1438dc4: sd

## 0.0.4

### Patch Changes

- sd

## 0.0.3

### Patch Changes

- ca3c691: sd

## 0.0.2

### Patch Changes

- sd

## 0.0.1

### Patch Changes

- 611b697: improvements
