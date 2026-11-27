---
name: query-db
description: Instructs agents on how to execute SQL queries directly against the local Supabase Postgres database. Trigger when you need to inspect database state, debug queries, or verify seeds.
---

# Querying the Local Database

When you need to verify or query the local Supabase database to inspect records or verify database state, you should use the `psql` command.

From the repository root, get the running worktree’s database URL from Supabase status. Chain the commands with `&&` so a status failure stops the query.

## How to Query

Run the following command directly in the terminal, replacing `<your_query>` with your SQL statement:

```bash
db_url=$(node scripts/local-supabase.mjs db-url) && psql "$db_url" -c "<your_query>"
```

### Examples

**List all tables**:

```bash
db_url=$(node scripts/local-supabase.mjs db-url) && psql "$db_url" -c "\dt"
```

**Select rows from a table (formatted as JSON for easier parsing in bash)**:

```bash
db_url=$(node scripts/local-supabase.mjs db-url) && psql "$db_url" -t -c "SELECT row_to_json(t) FROM (SELECT * FROM your_table LIMIT 5) t;"
```
