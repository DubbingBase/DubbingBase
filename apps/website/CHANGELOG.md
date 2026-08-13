# @app/landing

## 1.0.48

### Patch Changes

- ccac106: update about page content and simplify external database attribution strings
- Updated dependencies [ccac106]
  - @app/locales@0.0.48

## 1.0.47

### Patch Changes

- 96c2d3d: migrate data fetching to useAsyncData across app pages and components
- Updated dependencies [96c2d3d]
  - @app/shared-logic@1.0.26
  - @app/locales@0.0.47

## 1.0.46

### Patch Changes

- da3aff5: replace Date parsing with string splitting for year extraction, add header fallback UI, and update nuxt configuration

## 1.0.45

### Patch Changes

- d618dca: implement locale-aware data fetching by passing Accept-Language headers to Supabase functions
- Updated dependencies [d618dca]
  - @app/shared-logic@1.0.25

## 1.0.44

### Patch Changes

- 9803ad9: implement studio logo image upload and compression using Supabase storage
- ff073f6: migrate color palette from slate to gray across admin and edit pages
- 292ef80: improve grid responsiveness and remove hover zoom effects across movie, show, and actor pages

## 1.0.43

### Patch Changes

- 15ba600: remove unused nitro prerender config and add SWR rule for /game routes

## 1.0.42

### Patch Changes

- 056174f: add dynamic language support to TMDB requests, expand database relations, and update localized navigation routes
- Updated dependencies [056174f]
  - @app/shared-logic@1.0.24

## 1.0.41

### Patch Changes

- 7781f71: update task enrichment logic and add support for flexible task categories
- Updated dependencies [7781f71]
  - @app/locales@0.0.46

## 1.0.40

### Patch Changes

- bump
- Updated dependencies
  - @app/locales@0.0.45
  - @app/shared-logic@1.0.23

## 1.0.39

### Patch Changes

- b66bc35: fix: pipeline
- b66bc35: introduce gamification system with audit logs, task management, and contribution tracking hub
- Updated dependencies [b66bc35]
  - @app/shared-logic@1.0.22

## 1.0.38

### Patch Changes

- 4caba32: fix: pipeline

## 1.0.37

### Patch Changes

- 8a4a413: implement MediaSkeleton and PersonSkeleton components and enable lazy data loading for media pages

## 1.0.36

### Patch Changes

- ce35380: implement studio management features, add RLS policies, and introduce shared studio data composable
- Updated dependencies [ce35380]
- Updated dependencies [814588e]
  - @app/shared-logic@1.0.21

## 1.0.35

### Patch Changes

- edcdd13: implement movie and show dubbing edit pages with language selection component

## 1.0.34

### Patch Changes

- af640a5: add comprehensive video game support including database schema updates, backend integration, and dedicated game UI components.
- Updated dependencies [af640a5]
  - @app/shared-logic@1.0.20
  - @app/locales@0.0.44

## 1.0.33

### Patch Changes

- fae8d72: Temporarily skipped E2E tests in the CI pipeline to allow deployments to proceed.

## 1.0.32

### Patch Changes

- 27b779c: Fixed Playwright E2E pipeline: run tests against built apps instead of dev server, and injected missing ONESIGNAL_APP_ID secret.

## 1.0.31

### Patch Changes

- 70dfb6f: Added E2E tests for mobile and website apps to the GitHub Actions pipeline, and deduplicated Vue versions to resolve the "Cannot redefine property: imgEl" HMR bug.

## 1.0.30

### Patch Changes

- a30d030: implement user reporting system with new database migration, edge function, and modal component

## 1.0.29

### Patch Changes

- 8105616: integrate PostHog analytics for mobile and website with automated user identification and version tracking

## 1.0.28

### Patch Changes

- 9f014cd: implement dynamic SEO keywords and meta data across all pages

## 1.0.27

### Patch Changes

- b5f52e0: add user profile management, implement internationalized routing, and improve error handling in Supabase functions.
- 61dc335: replace native img tags with NuxtImg and force webp format for image optimization across all pages
- Updated dependencies [b5f52e0]
  - @app/shared-logic@1.0.19

## 1.0.26

### Patch Changes

- 981854d: implement legal and privacy policy pages, add registration flow, and update PostHog analytics integration

## 1.0.25

### Patch Changes

- 8b6f56a: migrate website app to Nuxt 3 and standardize Supabase edge function authentication.
- da720e4: modernize header UI, reorganize navigation, and remove redundant admin layouts
- Updated dependencies [da720e4]
  - @app/locales@0.0.43
  - @app/shared-logic@1.0.18

## 1.0.24

### Patch Changes

- a5f599a: standardize code formatting across apps and add profile management pages with authentication middleware
- Updated dependencies [a5f599a]
  - @app/shared-logic@1.0.17

## 1.0.23

### Patch Changes

- dba67a5: add high-resolution favicon and android touch icons to app head

## 1.0.22

### Patch Changes

- Updated dependencies
  - @app/locales@0.0.42

## 1.0.21

### Patch Changes

- b374bdf: qs
- Updated dependencies [b374bdf]
  - @app/locales@0.0.41
  - @app/shared-logic@1.0.16

## 1.0.20

### Patch Changes

- cee846b: notifications
- Updated dependencies [cee846b]
  - @app/locales@0.0.40
  - @app/shared-logic@1.0.15

## 1.0.19

### Patch Changes

- c45f275: bump
- Updated dependencies [c45f275]
  - @app/locales@0.0.39
  - @app/shared-logic@1.0.14

## 1.0.18

### Patch Changes

- 5e7fbe5: fix build
- Updated dependencies [5e7fbe5]
  - @app/locales@0.0.38
  - @app/shared-logic@1.0.13

## 1.0.17

### Patch Changes

- 664fea2: fix i18n redirection on internal routes

## 1.0.16

### Patch Changes

- 0a19c44: sd

## 1.0.15

### Patch Changes

- e29719d: sd
- Updated dependencies [e29719d]
  - @app/shared-logic@1.0.12
  - @app/locales@0.0.37

## 1.0.14

### Patch Changes

- sd
- Updated dependencies
  - @app/locales@0.0.36
  - @app/shared-logic@1.0.11

## 1.0.13

### Patch Changes

- sd
- Updated dependencies
  - @app/locales@0.0.35
  - @app/shared-logic@1.0.10

## 1.0.12

### Patch Changes

- 00d27b2: sd
- daf9923: d

## 1.0.11

### Patch Changes

- dh
- Updated dependencies
  - @app/locales@0.0.34
  - @app/shared-logic@1.0.9

## 1.0.10

### Patch Changes

- uodzte
- Updated dependencies
  - @app/locales@0.0.33
  - @app/shared-logic@1.0.8

## 1.0.9

### Patch Changes

- hs
- Updated dependencies
  - @app/locales@0.0.32
  - @app/shared-logic@1.0.7

## 1.0.8

### Patch Changes

- sds
- Updated dependencies
  - @app/locales@0.0.31
  - @app/shared-logic@1.0.6

## 1.0.7

### Patch Changes

- c9ea924: fix reload

## 1.0.6

### Patch Changes

- 29e86c3: sd

## 1.0.5

### Patch Changes

- sd
- Updated dependencies
  - @app/locales@0.0.30
  - @app/shared-logic@1.0.5

## 1.0.4

### Patch Changes

- df
- Updated dependencies
  - @app/locales@0.0.29
  - @app/shared-logic@1.0.4

## 1.0.3

### Patch Changes

- sd
- Updated dependencies
  - @app/shared-logic@1.0.3

## 1.0.2

### Patch Changes

- bump
- Updated dependencies
  - @app/shared-logic@1.0.2

## 1.0.1

### Patch Changes

- initialize landing app and implement shared logic for home dashboard data fetching
- Updated dependencies
  - @app/shared-logic@1.0.1
