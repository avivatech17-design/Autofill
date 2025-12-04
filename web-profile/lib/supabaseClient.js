import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const resumeBucket =
  process.env.NEXT_PUBLIC_SUPABASE_RESUME_BUCKET || 'resumes';

export const tables = {
  profile: 'profiles',
  experiences: 'autofill_experiences',
  educations: 'autofill_educations',
  skills: 'autofill_skills',
  languages: 'autofill_languages',
};

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase URL or anon key missing. Check your .env.local.');
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}
