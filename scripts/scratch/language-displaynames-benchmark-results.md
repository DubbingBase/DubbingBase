# Language display names benchmark

Run with `node scripts/scratch/benchmark-language-displaynames.mjs`. Each sample measures one synthetic request with eight language lookups, including `Intl.DisplayNames` construction, lookup formatting, and output array construction. The cached variant constructs one formatter per request; the previous variant constructs one per non-missing lookup. Results are directional synthetic measurements, not production request timings.

| Locale         | Scenario              | Iterations | Previous median/request | Cached median/request | Speedup |
| -------------- | --------------------- | ---------: | ----------------------: | --------------------: | ------: |
| `fr-FR`        | 8 languages           |     10,000 |                0.116 ms |              0.040 ms |    2.9× |
| `fr-FR`        | 7 languages + missing |     10,000 |                0.103 ms |              0.037 ms |    2.8× |
| invalid locale | 8 languages           |     10,000 |                0.050 ms |              0.005 ms |   10.3× |
| invalid locale | 7 languages + missing |     10,000 |                0.041 ms |              0.005 ms |    7.9× |

Old and cached outputs, including invalid-locale and missing-code fallbacks, were equivalent in each scenario; aggregate output checksums also matched.
