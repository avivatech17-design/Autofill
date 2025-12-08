# Extension-Web UI Sync Fix

## Root Cause
Extension and Web UI are using **different Supabase instances**, causing user accounts to be separate.

## The Fix

### Option 1: Use Web UI API (Recommended - Simple)
Make the extension fetch everything through the web UI's API instead of directly from Supabase.

1. Open extension popup → **Settings** tab
2. Click **"Advanced API Config"**
3. Set **API Base** to: `http://localhost:3000/api/profile`
4. Clear the other fields (API Base, API Key, Bucket) - leave them empty
5. Click **Login & Fetch**

This way the extension uses the web UI as a proxy, ensuring same database.

### Option 2: Match Supabase URLs (If you want direct access)
1. Check what Supabase URL your web UI uses in `.env.local`
2. Update extension Settings → Advanced API Config:
   - **API Base**: Your Supabase URL
   - **API Key**: Your anon key
   - **Bucket**: `resumes`

## Quick Test
After the fix:
1. Extension → Settings → Login with `vijayputta45@gmail.com`
2. Go to **Work** tab
3. Should now show Microsoft & Amazon data!
