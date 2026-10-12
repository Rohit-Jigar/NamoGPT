# Supabase Database Safety, Migration & Client Rules

These rules govern database architecture, migration authoring, authentication, and client code generation with Supabase.

## Database Safety Directives

1. **Destructive Operations Prohibition**:
   - NEVER run destructive DDL statements (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DATABASE RESET`) directly without explicit confirmation.
   - Always prefer additive schema evolutions (e.g., adding nullable columns, adding default constraints, deprecation cycles).

2. **Strict Row-Level Security (RLS) Mandate**:
   - Every table created in the `public` schema MUST have RLS explicitly enabled:
     ```sql
     ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
     ```
   - Do not leave tables unprotected. Define explicit policies for each operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
   - Use `auth.uid()` for user-ownership checks.
   - Reserve the Supabase service role key strictly for server-side trusted tasks; never expose or bundle service role keys in client-side code.

3. **Version-Controlled Migrations**:
   - Do not modify database schemas via ad-hoc, untracked queries.
   - Author migrations as idempotent SQL scripts with forward compatibility (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
   - Store migrations in `supabase/migrations/` using timestamped filenames.

4. **Client Code & Query Optimization**:
   - Explicitly list required fields in `.select('id, title, status')` instead of wildcard `.select('*')` to conserve network overhead and prevent inadvertent exposure of private columns.
   - Ensure foreign-key joined queries are properly indexed.
   - Use strongly typed TypeScript definitions generated from the Supabase schema (`Database` types).
