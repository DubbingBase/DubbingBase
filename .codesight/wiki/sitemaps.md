# Sitemaps

> **Navigation aid.** Route list and file locations extracted via AST. Read the source files listed below before implementing or modifying this subsystem.

The Sitemaps subsystem handles **2 routes**.

## Routes

- `GET` `/routes/sitemaps/:file` params(file)
  `apps/website/server/routes/sitemaps/[file].get.ts`
- `ALL` `/routes/sitemaps/pages.xml`
  `apps/website/server/routes/sitemaps/pages.xml.ts`

## Source Files

Read these before implementing or modifying this subsystem:
- `apps/website/server/routes/sitemaps/[file].get.ts`
- `apps/website/server/routes/sitemaps/pages.xml.ts`

---
_Back to [overview.md](./overview.md)_