# One-Time User Import

Use `import-users-from-csv.ts` to import player accounts into Supabase Auth and `public.profiles`.

## Environment

Add these values to `.env.local` only. Do not commit `.env.local`.

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The script requires the service role key because it calls `supabase.auth.admin.createUser()`. Never expose this key in browser code, screenshots, logs, commits, or pull requests.

## CSV Format

The checked-in import file is `scripts/120-users-csv.csv`. It must use these headers:

```csv
email,password,display_name
player1@example.com,password123,Player One
```

Required columns:

- `email`
- `password`
- `display_name`

## Run

```powershell
npx tsx scripts/import-users-from-csv.ts .\path\to\users.csv
```

To use the checked-in 120-user CSV, run:

```powershell
npx tsx scripts/import-users-from-csv.ts
```

For each row, the script:

- Creates a Supabase Auth user with `email_confirm: true`
- Sets `user_metadata.display_name`
- Upserts `public.profiles` with role `player`, status `approved`, and preferred language `en`

Run this script only once for the uploaded user list unless you intentionally want to create another batch.
