# Extension Data Sync Issue - Quick Fix Guide

## Problem
Work and education data saved in web UI doesn't appear in Chrome extension.

## Root Cause (Most Likely)
The extension is using **cached data** from before you added work/education entries.

## Quick Fix - Clear Extension Cache

### Option 1: Clear Cache via Extension
1. Open extension popup
2. Go to **Settings** tab  
3. Click **Login & Fetch** button again
   - This forces a fresh data fetch from API
   - Should override old cached data

### Option 2: Clear Chrome Storage
1. Open extension popup
2. Right-click → Inspect
3. Go to **Application** tab (top menu)
4. Left sidebar: **Storage** → **Local Storage** → `chrome-extension://...`
5. Right-click → **Clear**
6. Close and reopen extension
7. Login again

### Option 3: Reload Extension Completely
1. Go to `chrome://extensions`
2. Find ApplyPilot extension
3. Click **Remove**
4. Click **Load unpacked** again
5. Select `job-filler-extension` folder
6. Open extension → Settings → Login

## Verify the Fix
After clearing cache:
1. Extension popup → Settings tab
2. Login with your credentials
3. Wait for "Profile synced from cloud"
4. Click **Work** tab
5. Should now show your Amazon/Software engineer experience
6. Should show Stanford University education

## If Still Not Working
Open extension console (right-click → Inspect) and look for:
```
[EXTENSION] Payload received: ...experiencesCount: X
```

If `experiencesCount` is 0, the API isn't returning data. Please share that console output.
