push local db to remote using migrations

```
supabase db push
```

create a new migration based on the diff of the local and remote db

```
pnpm supabase db diff -f initial-schema
```

generate seed data

```
supabase db dump -f supabase/seed.sql --data-only
```

apply all migrations

```
supabase db reset
```
