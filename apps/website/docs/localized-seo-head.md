# Localized SEO URLs

`app.vue` uses Nuxt i18n's reactive locale head as the source for canonical and
alternate URLs. With `prefix_except_default`, English uses the unprefixed route
and French, Spanish, and Japanese use `/fr`, `/es`, and `/ja`. Each supported
locale links to the same route in the other locales; `x-default` points to the
English route.

The global Open Graph and Twitter URL metadata use the generated canonical URL.
Public route metadata follows the current route during client navigation. The
indexable route families covered here are the home, movie, show, season,
episode, actor, voice actor, and empty search routes. Search queries retain the
existing `noindex` behavior. Indexation of dubbing selection query parameters
is tracked separately and is not changed by this policy.
