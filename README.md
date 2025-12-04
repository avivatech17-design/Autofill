# Apply Profile + Extension (Supabase-backed)

This repo has two parts:

- `web-profile/`: a small Next.js app to edit your Simplify-style profile and upload a resume to Supabase.
- `job-filler-extension/`: a Chrome extension that can pull the same profile/resume from Supabase and autofill job forms.

## Supabase setup (once)
1. Create a Supabase project. Grab `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
2. Create table `profiles`:
   ```sql
   create table profiles (
     id uuid primary key references auth.users(id),
     full_name text,
     email text,
     phone text,
     city text,
     state text,
     postal text,
     country text,
     address text,
     linkedin_url text,
     github_url text,
     portfolio_url text,
     current_company text,
     current_title text,
     highest_degree text,
     school_name text,
     graduation_year int,
     resume_path text,
     updated_at timestamp
   );

   alter table profiles enable row level security;
   create policy "owner can read" on profiles
     for select using (auth.uid() = id);
   create policy "owner can upsert" on profiles
     for all using (auth.uid() = id)
     with check (auth.uid() = id);
   ```
3. Storage: create bucket `resumes` (or your name) with owner-only read/write.

## Web app (`web-profile/`)
1. `cd web-profile`
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and bucket name.
3. `npm install` (once) then `npm run dev`.
4. Visit `http://localhost:3000/`:
   - Sign up / log in with Supabase auth.
   - Fill profile fields, upload resume, click **Save profile**.

## Extension (`job-filler-extension/`)
1. In Chrome: `chrome://extensions` → enable Developer mode → Load unpacked → select `job-filler-extension/`.
2. In the popup:
   - Enter Supabase URL, anon key, bucket, and your Supabase auth email/password.
   - Click **Login & Fetch Profile** to pull profile/resume from Supabase (also saved locally).
   - Optionally edit fields or select a resume locally; **Save** to keep locally; **Save to Supabase** to push profile/resume back to Supabase.
3. On any form page, click **Fill Current Form**. The extension autofills inputs, selects dropdowns (state/country/source, etc.), attaches the stored resume (including drag-and-drop targets), and auto-clicks Next/Continue when found.

Notes:
- The extension uses Supabase REST (no external bundles) and stores the session/token in `chrome.storage.local`.
- Host permissions include `https://*.supabase.co/*` to call Supabase REST and Storage.
- If your upload widget is a dropzone, the extension simulates a drop event with your resume file. If it still doesn’t attach, share the element text/labels and we can add a targeted selector.
