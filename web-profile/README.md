# Web Profile (Supabase-backed)

Minimal Simplify-style profile page to save your job application data + resume into Supabase.

## Setup
1. Copy `.env.example` to `.env.local` and fill `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_RESUME_BUCKET` (default `resumes`).
2. Ensure Supabase has:
   - Table `profiles` with columns:
     - `id uuid primary key references auth.users(id)`
     - `full_name text`
     - `email text`
     - `phone text`
     - `city text`
     - `state text`
     - `postal text`
     - `country text`
     - `linkedin_url text`
     - `github_url text`
     - `portfolio_url text`
     - `current_company text`
     - `current_title text`
     - `highest_degree text`
     - `school_name text`
     - `graduation_year int`
     - `resume_path text`
     - `updated_at timestamp`
   - RLS enabled with policies:
     ```sql
     alter table profiles enable row level security;
     create policy "owner can read" on profiles
       for select using (auth.uid() = id);
     create policy "owner can upsert" on profiles
       for all using (auth.uid() = id)
       with check (auth.uid() = id);
     ```
   - Storage bucket `resumes` with owner-only read/write.
3. Install deps: `npm install`
4. Run: `npm run dev` (within `web-profile/`).

## Usage
- Sign up / log in (email + password) via Supabase auth.
- Fill profile fields, upload a resume (PDF/DOC/DOCX/TXT).
- Click **Save profile**. The resume uploads to the bucket and path is stored in `profiles.resume_path`.
- The page shows a signed URL to view the stored resume.

## How this ties to the extension
- The Chrome extension can log in to Supabase and fetch the same `profiles` row plus the stored resume file to autofill job forms. The Supabase URL + anon key + user credentials are shared between web and extension.
