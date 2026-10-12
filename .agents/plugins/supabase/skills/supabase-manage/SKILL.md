---
name: supabase-manage
description: Procedures for inspecting Supabase database schemas, generating safe migrations, managing Row Level Security policies, running non-destructive SQL queries, and configuring auth. Use when modifying database tables, reviewing schema designs, or configuring Supabase Auth.
---

# Supabase Management Workflow

Follow this procedure to safely inspect database schemas, write idempotent migrations, configure RLS, and manage authentication using Supabase MCP.

## Workflow Steps

### Step 1: Inspect Schemas and Tables
1. Use Supabase MCP tools to retrieve existing schema definitions, tables, columns, constraints, and indexes.
2. Review foreign-key relationships and verify existing Row Level Security (RLS) policies on active tables.
3. Check table schema definitions against client-side TypeScript types.

### Step 2: Author Safe, Idempotent Migrations
1. Formulate migration scripts adhering to safe SQL practices:
   - Use idempotent statements (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
   - Add proper indexing for foreign keys and frequently queried filter columns.
   - Establish `created_at` / `updated_at` timestamps with appropriate triggers or defaults.
2. Store migration files in the repository under `supabase/migrations/<timestamp>_<migration_name>.sql`.

### Step 3: Configure Row Level Security (RLS) Policies
1. Ensure RLS is active:
   ```sql
   ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
   ```
2. Create granular policies tailored to user identities:
   - Policy for read access (e.g., users can read their own records or public records).
   - Policy for insert access (e.g., `WITH CHECK (auth.uid() = user_id)`).
   - Policy for update/delete access (e.g., `USING (auth.uid() = user_id)`).

### Step 4: Manage Auth & User Profiles
1. Inspect Supabase Auth configuration (OAuth providers, email sign-up, JWT expiry).
2. Ensure automated profile creation triggers (e.g., `on_auth_user_created` trigger inserting into `public.profiles`) maintain transactional integrity.
3. Validate session handling and refresh token behavior across client applications.

### Step 5: Generate Types and Verify Integration
1. Generate fresh TypeScript definitions from the schema.
2. Validate client queries in the application against newly created tables and columns.
3. Test edge cases where unauthorized users attempt to read or mutate protected rows to confirm RLS enforcement.
