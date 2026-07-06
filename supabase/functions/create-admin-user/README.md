# create-admin-user

Supabase Edge Function for creating administrator accounts.

This function is intentionally server-side because it uses `SUPABASE_SERVICE_ROLE_KEY` to call Supabase Auth Admin APIs. Never expose the service role key in frontend code, browser bundles, logs, screenshots, or commits.

## Request

Call the deployed function with an approved admin user's access token:

```http
POST /functions/v1/create-admin-user
Authorization: Bearer <admin user jwt>
Content-Type: application/json
```

Body:

```json
{
  "email": "newadmin@example.com",
  "password": "temporary-password",
  "display_name": "New Admin",
  "preferred_language": "en"
}
```

The caller must have a `public.profiles` row where:

- `id` matches the authenticated Supabase user id
- `role = 'admin'`
- `status = 'approved'`

## Deploy

From the project root:

```bash
supabase functions deploy create-admin-user
```

## Secrets

Set these function secrets in Supabase:

```bash
supabase secrets set SUPABASE_URL=<your-project-url>
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` is required for:

- `supabase.auth.admin.createUser()`
- upserting `public.profiles` as the trusted backend

## Result

On success, the function creates a confirmed Supabase Auth user and upserts `public.profiles` with:

- `id = auth user id`
- `email`
- `display_name`
- `role = 'admin'`
- `status = 'approved'`
- `preferred_language`
