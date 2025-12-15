import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { tables } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resumeBucket =
  process.env.NEXT_PUBLIC_SUPABASE_RESUME_BUCKET || 'resumes';

if (!supabaseUrl) {
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL for /api/profile');
}
if (!supabaseServiceKey) {
  console.warn('Missing SUPABASE_SERVICE_ROLE_KEY for /api/profile');
}

export async function GET(request) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Server not configured' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : null;

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }

  console.log('DEBUG: API GET profile for user:', user.id);

  const { data: profile, error: profileError } = await supabase
    .from(tables.profile)
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 400 }
    );
  }

  const [expRes, eduRes, skillRes, langRes] = await Promise.all([
    supabase
      .from(tables.experiences)
      .select('*')
      .eq('user_id', user.id)
      .order('end_year', { ascending: false }),
    supabase
      .from(tables.educations)
      .select('*')
      .eq('user_id', user.id),
    supabase
      .from(tables.skills)
      .select('*')
      .eq('user_id', user.id),
    supabase
      .from(tables.languages)
      .select('*')
      .eq('user_id', user.id),
  ]);

  console.log('DEBUG: API GET experiences:', JSON.stringify(expRes.data), expRes.error);
  console.log('DEBUG: API GET skills count:', skillRes.data?.length, 'First skill:', skillRes.data?.[0]);

  let resumeUrl = null;
  if (profile?.resume_path) {
    const { data: signed, error: signedError } = await supabase.storage
      .from(resumeBucket)
      .createSignedUrl(profile.resume_path, 60 * 60);
    if (signedError) {
      console.warn('Signed URL error:', signedError.message);
    } else {
      resumeUrl = signed?.signedUrl || null;
    }
  }

  // Add user email to profile if not present or empty
  if (profile && (!profile.email || profile.email.trim() === '') && user.email) {
    profile.email = user.email;
  }

  return NextResponse.json({
    profile,
    experiences: expRes.data || [],
    educations: eduRes.data || [],
    skills: skillRes.data || [],
    languages: langRes.data || [],
    resumeUrl,
  });
}
