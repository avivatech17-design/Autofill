'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { getSupabaseClient, resumeBucket, tables } from '@/lib/supabaseClient';
import { useRouter, useSearchParams } from 'next/navigation';
import { Country, State, City } from 'country-state-city';
import Autocomplete from './components/Autocomplete';
import { companies, jobTitles, universities, degrees, majors, skills, languages, races, veteranStatuses, disabilityStatuses, roles, roleSkills } from '@/lib/data';

const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const years = Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i);

const MonthYearSelect = ({ month, year, onChangeMonth, onChangeYear, labelPrefix }) => (
  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
    <div style={{ flex: 1 }}>
      <label>{labelPrefix} Month</label>
      <select value={month || ''} onChange={e => onChangeMonth(e.target.value)}>
        <option value="">Select</option>
        {months.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
    <div style={{ flex: 1 }}>
      <label>{labelPrefix} Year</label>
      <select value={year || ''} onChange={e => onChangeYear(e.target.value)}>
        <option value="">Select</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  </div>
);

const emptyProfile = {
  full_name: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  country: '',
  linkedin_url: '',
  github_url: '',
  portfolio_url: '',
  current_company: '',
  current_title: '',
  resume_path: '',
  race: '',
  veteran_status: '',
  disability_status: '',
  primary_role: '',
};

const emptyExperience = {
  company_name: '',
  job_title: '',
  location: '',
  start_month: '',
  start_year: '',
  end_month: '',
  end_year: '',
  is_current: false,
  description: '',
};

const emptyEducation = {
  school_name: '',
  major: '',
  degree_type: '',
  start_month: '',
  start_year: '',
  end_month: '',
  end_year: '',
};

export default function Page() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState(null);
  const [authStatus, setAuthStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState(emptyProfile);
  const [experiences, setExperiences] = useState([{ ...emptyExperience }]);
  const [educations, setEducations] = useState([{ ...emptyEducation }]);
  const [userSkills, setUserSkills] = useState([]);
  const userSkillsRef = useRef([]);

  useEffect(() => {
    userSkillsRef.current = userSkills;
  }, [userSkills]);

  const [userLanguages, setUserLanguages] = useState([]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        setSession(data.session);
        setEmail(data.session.user.email || '');
        loadAll(data.session);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        setEmail(newSession.user.email || '');
        loadAll(newSession);
      } else {
        resetAll();
      }
    });
    return () => listener?.subscription.unsubscribe();
  }, [supabase]);

  // Sync tab from URL
  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'work') setActiveTab('work');
    else setActiveTab('profile');
  }, [searchParams]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    router.replace(`/?tab=${tab}`);
  };

  const resetAll = () => {
    setProfile(emptyProfile);
    setExperiences([{ ...emptyExperience }]);
    setEducations([{ ...emptyEducation }]);
    setUserSkills([]);
    setUserLanguages([]);
  };

  const isFetching = useRef(false);

  const loadAll = async (activeSession) => {
    if (isFetching.current) return;
    isFetching.current = true;

    if (!supabase || !activeSession?.access_token) {
      isFetching.current = false;
      return;
    }
    try {
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      });
      const json = await res.json();

      if (!res.ok) {
        setAuthStatus(`Load error: ${json.error || res.statusText}`);
        return;
      }
      const p = json.profile || {};
      setProfile({ ...emptyProfile, ...p });
      setExperiences(json.experiences?.length ? json.experiences : [{ ...emptyExperience }]);
      setEducations(json.educations?.length ? json.educations : [{ ...emptyEducation }]);
      setUserSkills(json.skills || []);
      setUserLanguages(json.languages || []);
    } catch (e) {
      setAuthStatus(`Error: ${e.message || e.toString()}`);
    } finally {
      isFetching.current = false;
    }
  };

  const [isSignUp, setIsSignUp] = useState(false);

  const handleLogin = async () => {
    if (!supabase) return setAuthStatus('Supabase not configured.');
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthStatus(`Login failed: ${error.message}`);
    else {
      setSession(data.session);
      setAuthStatus('Logged in');
      await loadAll(data.session);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    if (!supabase) return setAuthStatus('Supabase not configured.');
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthStatus(`Sign up failed: ${error.message}`);
    } else {
      setAuthStatus('Sign up successful! Check your email (if enabled) or sign in.');
      if (data?.session) {
        setSession(data.session);
        loadAll(data.session);
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetAll();
    setAuthStatus('Signed out');
  };

  const savePersonal = async () => {
    if (!supabase || !session?.user) return;
    setLoading(true);
    const uid = session.user.id;
    try {
      const { error } = await supabase
        .from(tables.profile)
      const payload = {
        id: uid,
        updated_at: new Date().toISOString(),
        full_name: profile.full_name || null,
        email: profile.email || null,
        phone: profile.phone || null,
        city: profile.city || null,
        state: profile.state || null,
        country: profile.country || null,
        linkedin_url: profile.linkedin_url || null,
        github_url: profile.github_url || null,
        portfolio_url: profile.portfolio_url || null,
        current_company: profile.current_company || null,
        current_title: profile.current_title || null,
        resume_path: profile.resume_path || null,
        race: profile.race || null,
        veteran_status: profile.veteran_status || null,
        disability_status: profile.disability_status || null,
        primary_role: profile.primary_role || null
      };
      console.log('DEBUG: Upsert payload:', payload);

      const { error: profileError } = await supabase
        .from(tables.profile)
        .upsert(payload, { onConflict: 'id' });
      if (profileError) throw profileError;
      setAuthStatus('Saved personal info');

      // Also save skills if they were modified (e.g. via auto-add)
      const currentSkills = userSkillsRef.current;
      if (currentSkills.length > 0) {
        const skillsClean = currentSkills.map(s => ({ user_id: uid, skill_name: s.skill_name || s }));
        await supabase.from(tables.skills).delete().eq('user_id', uid);
        await supabase.from(tables.skills).insert(skillsClean);
        setAuthStatus('Saved personal info & skills');
      }
    } catch (e) {
      setAuthStatus(`Save error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const saveWork = async () => {
    if (!supabase || !session?.user) return;
    setLoading(true);
    const uid = session.user.id;

    const toInt = (val) => {
      if (!val) return null;
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    };

    // Filter out empty entries
    const expClean = experiences
      .filter(e => e.company_name && e.company_name.trim() !== '')
      .map(e => ({
        user_id: uid,
        company_name: e.company_name,
        job_title: e.job_title,
        location: e.location,
        start_month: e.start_month,
        start_year: toInt(e.start_year),
        end_month: e.is_current ? null : e.end_month,
        end_year: e.is_current ? null : toInt(e.end_year),
        is_current: e.is_current,
        description: e.description
      }));

    const eduClean = educations
      .filter(e => e.school_name && e.school_name.trim() !== '')
      .map(e => ({
        user_id: uid,
        school_name: e.school_name,
        degree_type: e.degree_type,
        major: e.major,
        start_month: e.start_month,
        start_year: toInt(e.start_year),
        end_month: e.end_month,
        end_year: toInt(e.end_year),
        description: e.description
      }));

    const skillsClean = userSkills.map(s => ({ user_id: uid, skill_name: s.skill_name || s }));
    const langsClean = userLanguages.map(l => ({ user_id: uid, language_name: l.language_name || l, proficiency: 'Native' })); // Default proficiency for now

    try {
      // Delete existing
      await supabase.from(tables.experiences).delete().eq('user_id', uid);
      await supabase.from(tables.educations).delete().eq('user_id', uid);
      await supabase.from(tables.skills).delete().eq('user_id', uid);
      await supabase.from(tables.languages).delete().eq('user_id', uid);

      // Insert new
      if (expClean.length > 0) await supabase.from(tables.experiences).insert(expClean);
      if (eduClean.length > 0) await supabase.from(tables.educations).insert(eduClean);
      if (skillsClean.length > 0) await supabase.from(tables.skills).insert(skillsClean);
      if (langsClean.length > 0) await supabase.from(tables.languages).insert(langsClean);

      setAuthStatus('Saved work, education, skills & languages');
      // Reload to get generated IDs
      await loadAll(session);
    } catch (e) {
      console.error(e);
      setAuthStatus(`Save error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (!supabase || !session?.user) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      // Use a fixed filename to replace the old one
      const fileName = `${session.user.id}/resume.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from(resumeBucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from(tables.profile)
        .update({ resume_path: fileName })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, resume_path: fileName });
      setAuthStatus('Resume uploaded!');
    } catch (e) {
      setAuthStatus(`Upload error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const initials = () => {
    return (profile.full_name || '?')
      .split(' ')
      .slice(0, 2)
      .map(s => s[0])
      .join('')
      .toUpperCase();
  };

  if (!session) {
    return (
      <div className="app-shell" style={{ maxWidth: '480px', marginTop: '100px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1>{isSignUp ? 'Create Account' : 'Welcome'}</h1>
          <p>{isSignUp ? 'Sign up to get started.' : 'Sign in to manage your ApplyPilot profile.'}</p>

          <div style={{ textAlign: 'left' }}>
            <label>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />

            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={isSignUp ? handleSignUp : handleLogin} disabled={loading}>
            {loading ? (isSignUp ? 'Signing up...' : 'Signing in...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>

          <div style={{ marginTop: '12px', fontSize: '14px' }}>
            <span className="link" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </span>
          </div>

          {authStatus && <div className="muted" style={{ marginTop: '16px', color: 'var(--danger-color)' }}>{authStatus}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="flex-between">
        <div className="flex-between" style={{ gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--accent-color)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '600', fontSize: '14px'
          }}>
            {initials()}
          </div>
          <div>
            <div style={{ fontWeight: '600' }}>{profile.full_name || 'Your Profile'}</div>
            <div className="muted">{session.user.email}</div>
          </div>
        </div>
        <button className="btn-secondary" onClick={handleLogout}>Sign Out</button>
      </header>

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => switchTab('profile')}
        >
          Profile
        </button>
        <button
          className={`tab-btn ${activeTab === 'work' ? 'active' : ''}`}
          onClick={() => switchTab('work')}
        >
          Work
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="animate-fade-in">
          <div className="card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <div className="section-title" style={{ margin: 0 }}>Personal Information</div>
              <button className="btn-primary" onClick={savePersonal} disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="row">
              <div>
                <label>Full Name</label>
                <input value={profile.full_name} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
              </div>
              <div>
                <label>Phone</label>
                <input value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
              </div>
            </div>

            <div className="row">
              <div>
                <label>Country</label>
                <select
                  value={profile.country}
                  onChange={(e) => {
                    setProfile({ ...profile, country: e.target.value, state: '', city: '' });
                  }}
                >
                  <option value="">Select Country</option>
                  {Country.getAllCountries()
                    .filter(c => c.isoCode === 'US')
                    .map((country) => (
                      <option key={country.isoCode} value={country.isoCode}>
                        {country.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label>State</label>
                <select
                  value={profile.state || ''}
                  onChange={(e) => {
                    setProfile({ ...profile, state: e.target.value, city: '' });
                  }}
                  disabled={!profile.country}
                >
                  <option value="">Select State</option>
                  {State.getStatesOfCountry(profile.country).map((state) => (
                    <option key={state.isoCode} value={state.isoCode}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>City</label>
                <select
                  value={profile.city || ''}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  disabled={!profile.state}
                >
                  <option value="">Select City</option>
                  {City.getCitiesOfState(profile.country, profile.state).map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Links</div>
            <div className="row">
              <div>
                <label>LinkedIn URL</label>
                <input value={profile.linkedin_url} onChange={e => setProfile({ ...profile, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
              </div>
              <div>
                <label>GitHub URL</label>
                <input value={profile.github_url} onChange={e => setProfile({ ...profile, github_url: e.target.value })} placeholder="https://github.com/..." />
              </div>
              <div>
                <label>Portfolio URL</label>
                <input value={profile.portfolio_url} onChange={e => setProfile({ ...profile, portfolio_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Demographics</div>
            <div className="row">
              <div>
                <label>Race / Ethnicity</label>
                <select
                  value={profile.race || ''}
                  onChange={e => setProfile({ ...profile, race: e.target.value })}
                >
                  <option value="">Select Race</option>
                  {races.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label>Veteran Status</label>
                <select
                  value={profile.veteran_status || ''}
                  onChange={e => setProfile({ ...profile, veteran_status: e.target.value })}
                >
                  <option value="">Select Status</option>
                  {veteranStatuses.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div style={{ flex: 1 }}>
                <label>Disability Status</label>
                <select
                  value={profile.disability_status || ''}
                  onChange={e => setProfile({ ...profile, disability_status: e.target.value })}
                >
                  <option value="">Select Status</option>
                  {disabilityStatuses.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Primary Role & Skills</div>
            <div style={{ marginBottom: '16px' }}>
              <label>Primary Role (auto-adds top ~100 skills)</label>
              <select
                value={profile.primary_role || ''}
                onChange={e => {
                  const role = e.target.value;
                  const updatedProfile = { ...profile, primary_role: role };
                  setProfile(updatedProfile);

                  if (role && roleSkills[role]) {
                    // Auto-add skills for the selected role
                    const newSkills = [...userSkills];
                    roleSkills[role].forEach(skill => {
                      if (!newSkills.some(s => (s.skill_name || s) === skill)) {
                        newSkills.push(skill);
                      }
                    });
                    setUserSkills(newSkills);
                    // Trigger save immediately with new skills? Or just let user click save.
                    // User flow: Select role -> Skills appear -> User clicks Save.
                    // If user clicks Save, savePersonal() is called.
                    // We need to ensure savePersonal() sees the new skills.
                  }
                }}
              >
                <option value="">Select Role</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="section-title" style={{ fontSize: '16px', marginTop: '12px' }}>My Skills ({userSkills.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {userSkills.map((s, i) => (
                <div key={i} style={{
                  background: '#e0f2fe', color: '#0284c7', padding: '4px 12px', borderRadius: '16px',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px'
                }}>
                  {s.skill_name || s}
                  <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                    setUserSkills(userSkills.filter((_, idx) => idx !== i));
                  }}>×</span>
                </div>
              ))}
            </div>
            <Autocomplete
              value=""
              options={skills}
              placeholder="Add a skill manually (e.g. React)"
              onChange={(val) => {
                if (!userSkills.some(s => (s.skill_name || s) === val)) {
                  setUserSkills([...userSkills, val]);
                }
              }}
            />
          </div>

          <div className="card">
            <div className="section-title">Languages</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {userLanguages.map((l, i) => (
                <div key={i} style={{
                  background: '#f0fdf4', color: '#16a34a', padding: '4px 12px', borderRadius: '16px',
                  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px'
                }}>
                  {l.language_name || l}
                  <span style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
                    setUserLanguages(userLanguages.filter((_, idx) => idx !== i));
                  }}>×</span>
                </div>
              ))}
            </div>
            <Autocomplete
              value=""
              options={languages}
              placeholder="Add a language (e.g. English)"
              onChange={(val) => {
                if (!userLanguages.some(l => (l.language_name || l) === val)) {
                  setUserLanguages([...userLanguages, val]);
                }
              }}
            />
          </div>

          <div className="card">
            <div className="section-title">Resume</div>
            {profile.resume_path && (
              <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                Current Resume: <a href="#" style={{ color: 'var(--primary-color)' }}>{profile.resume_path.split('/').pop()}</a>
              </div>
            )}
            <input type="file" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} />
          </div>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="animate-fade-in">
          <div className="card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <div className="section-title" style={{ margin: 0 }}>Experience</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" onClick={() => setExperiences([...experiences, { ...emptyExperience }])}>+ Add</button>
                <button className="btn-primary" onClick={saveWork} disabled={loading}>Save</button>
              </div>
            </div>

            {experiences.map((exp, idx) => (
              <div key={exp.id || idx} className="work-item">
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <div className="work-role">Position {idx + 1}</div>
                  {experiences.length > 1 && (
                    <button className="btn-danger" onClick={() => setExperiences(experiences.filter((_, i) => i !== idx))}>Remove</button>
                  )}
                </div>

                <div className="row">
                  <div>
                    <label style={{ marginTop: 0 }}>Company</label>
                    <Autocomplete
                      value={exp.company_name || ''}
                      options={companies}
                      placeholder="e.g. Google"
                      onChange={(val) => {
                        const newExp = [...experiences];
                        newExp[idx].company_name = val;
                        setExperiences(newExp);
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ marginTop: 0 }}>Title</label>
                    <Autocomplete
                      value={exp.job_title || ''}
                      options={jobTitles}
                      placeholder="e.g. Software Engineer"
                      onChange={(val) => {
                        const newExp = [...experiences];
                        newExp[idx].job_title = val;
                        setExperiences(newExp);
                      }}
                    />
                  </div>
                </div>

                <div className="row">
                  <MonthYearSelect
                    labelPrefix="Start"
                    month={exp.start_month}
                    year={exp.start_year}
                    onChangeMonth={(val) => {
                      const newExp = [...experiences];
                      newExp[idx].start_month = val;
                      setExperiences(newExp);
                    }}
                    onChangeYear={(val) => {
                      const newExp = [...experiences];
                      newExp[idx].start_year = val;
                      setExperiences(newExp);
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                      <input
                        type="checkbox"
                        checked={exp.is_current}
                        onChange={e => {
                          const newExp = [...experiences];
                          newExp[idx].is_current = e.target.checked;
                          if (e.target.checked) {
                            newExp[idx].end_month = '';
                            newExp[idx].end_year = '';
                          }
                          setExperiences(newExp);
                        }}
                        style={{ width: 'auto', marginRight: '8px' }}
                      />
                      <label style={{ margin: 0 }}>I currently work here</label>
                    </div>
                    {!exp.is_current && (
                      <MonthYearSelect
                        labelPrefix="End"
                        month={exp.end_month}
                        year={exp.end_year}
                        onChangeMonth={(val) => {
                          const newExp = [...experiences];
                          newExp[idx].end_month = val;
                          setExperiences(newExp);
                        }}
                        onChangeYear={(val) => {
                          const newExp = [...experiences];
                          newExp[idx].end_year = val;
                          setExperiences(newExp);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <div className="section-title" style={{ margin: 0 }}>Education</div>
              <button className="btn-secondary" onClick={() => setEducations([...educations, { ...emptyEducation }])}>+ Add</button>
            </div>

            {educations.map((edu, idx) => (
              <div key={edu.id || idx} className="work-item">
                <div className="flex-between" style={{ marginBottom: '12px' }}>
                  <div className="work-role">School {idx + 1}</div>
                  {educations.length > 1 && (
                    <button className="btn-danger" onClick={() => setEducations(educations.filter((_, i) => i !== idx))}>Remove</button>
                  )}
                </div>



                <div className="row">
                  <div>
                    <label style={{ marginTop: 0 }}>School</label>
                    <Autocomplete
                      value={edu.school_name || ''}
                      options={universities}
                      placeholder="e.g. Stanford University"
                      onChange={(val) => {
                        const newEdu = [...educations];
                        newEdu[idx].school_name = val;
                        setEducations(newEdu);
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ marginTop: 0 }}>Degree</label>
                    <Autocomplete
                      value={edu.degree_type || ''}
                      options={degrees}
                      placeholder="e.g. Bachelor of Science"
                      onChange={(val) => {
                        const newEdu = [...educations];
                        newEdu[idx].degree_type = val;
                        setEducations(newEdu);
                      }}
                    />
                  </div>
                </div>

                <div className="row">
                  <div style={{ flex: 1 }}>
                    <label style={{ marginTop: 0 }}>Major</label>
                    <Autocomplete
                      value={edu.major || ''}
                      options={majors}
                      placeholder="e.g. Computer Science"
                      onChange={(val) => {
                        const newEdu = [...educations];
                        newEdu[idx].major = val;
                        setEducations(newEdu);
                      }}
                    />
                  </div>
                </div>

                <div className="row">
                  <MonthYearSelect
                    labelPrefix="Start"
                    month={edu.start_month}
                    year={edu.start_year}
                    onChangeMonth={(val) => {
                      const newEdu = [...educations];
                      newEdu[idx].start_month = val;
                      setEducations(newEdu);
                    }}
                    onChangeYear={(val) => {
                      const newEdu = [...educations];
                      newEdu[idx].start_year = val;
                      setEducations(newEdu);
                    }}
                  />
                  <MonthYearSelect
                    labelPrefix="End"
                    month={edu.end_month}
                    year={edu.end_year}
                    onChangeMonth={(val) => {
                      const newEdu = [...educations];
                      newEdu[idx].end_month = val;
                      setEducations(newEdu);
                    }}
                    onChangeYear={(val) => {
                      const newEdu = [...educations];
                      newEdu[idx].end_year = val;
                      setEducations(newEdu);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {authStatus && (
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px',
          background: '#333', color: 'white', padding: '10px 20px',
          borderRadius: '8px', fontSize: '13px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          {authStatus}
        </div>
      )}
    </div>
  );
}
