---
name: query-db
description: Instructs agents on how to execute SQL queries directly against the local Supabase Postgres database. Trigger when you need to inspect database state, debug queries, or verify seeds.
---

# Querying the Local Database

When you need to verify or query the local Supabase database to inspect records or verify database state, you should use the `psql` command.

The local Supabase database runs on port `55322` and the password for the default `postgres` user is `postgres`.

## How to Query

Run the following command directly in the terminal, replacing `<your_query>` with your SQL statement:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "<your_query>"
```

### Examples

**List all tables**:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -c "\dt"
```

**Select rows from a table (formatted as JSON for easier parsing in bash)**:
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 55322 -U postgres -d postgres -t -c "SELECT row_to_json(t) FROM (SELECT * FROM your_table LIMIT 5) t;"
```
