'use client';

import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

export default function ProfileJsonPage() {
  const supa = getSupabaseClient();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('Click "Load profile" to view your data.');

  const load = async () => {
    if (!supa) {
      setStatus('Supabase not configured (.env).');
      return;
    }
    setStatus('Loading...');
    const { data: sessionData, error: sessionError } = await supa.auth.getSession();
    if (sessionError || !sessionData.session) {
      setStatus('Please log in first in this app.');
      return;
    }
    const token = sessionData.session.access_token;
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${json.error || res.statusText}`);
        return;
      }
      setData(json);
      setStatus('Loaded');
    } catch (e) {
      setStatus(`Error: ${e.message || e.toString()}`);
    }
  };

  useEffect(() => {
    // Attempt auto-load if already logged in
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Profile JSON</h1>
          <p className="text-sm text-gray-600">
            Uses your current session to call <code>/api/profile</code> and display everything (profile, experiences, educations, skills, languages, resume URL).
          </p>
        </div>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white hover:opacity-90"
          onClick={load}
        >
          Load profile
        </button>
      </div>
      <div className="text-sm text-gray-700">{status}</div>
      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-[70vh]">
{JSON.stringify(data, null, 2) || 'No data'}
      </pre>
    </div>
  );
}
