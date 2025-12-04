// Elements
const sbUrlInput = document.getElementById("sbUrl");
const sbAnonInput = document.getElementById("sbAnon");
const sbBucketInput = document.getElementById("sbBucket");
const apiBaseInput = document.getElementById("apiBase");
const sbEmailInput = document.getElementById("sbEmail");
const sbPasswordInput = document.getElementById("sbPassword");
const sbLoginBtn = document.getElementById("sbLogin");
const sbStatus = document.getElementById("sbStatus");
const openWebBtn = document.getElementById("openWeb");
const fillBtn = document.getElementById("fill");
const statusEl = document.getElementById("status");

// UI Elements
const userInitialsEl = document.getElementById("user-initials");
const profileView = document.getElementById("profile-view");
const loginView = document.getElementById("login-view");
const dispName = document.getElementById("dispName");
const dispEmail = document.getElementById("dispEmail");
const dispPhone = document.getElementById("dispPhone");
const dispLoc = document.getElementById("dispLoc");
const linkLi = document.getElementById("linkLi");
const linkGh = document.getElementById("linkGh");
const linkPort = document.getElementById("linkPort");
const expList = document.getElementById("exp-list");
const eduList = document.getElementById("edu-list");
const goToSettingsBtn = document.getElementById("goToSettingsBtn");

// Tabs
const tabs = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    // Remove active class from all
    tabs.forEach((t) => t.classList.remove("active"));
    tabContents.forEach((c) => c.classList.remove("active"));

    // Add active class to clicked
    tab.classList.add("active");
    const target = tab.dataset.tab;
    document.getElementById(`tab-${target}`).classList.add("active");
  });
});

if (goToSettingsBtn) {
  goToSettingsBtn.addEventListener("click", () => {
    document.querySelector('[data-tab="settings"]').click();
  });
}

function updateResumeStatus() {
  // no-op in minimal UI
}

const DEFAULT_SUPA = {
  url: "https://hlnziqyaovhefahcdxps.supabase.co",
  anonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsbnppcXlhb3ZoZWZhaGNkeHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNDYwNzcsImV4cCI6MjA3OTkyMjA3N30.8fpmV4sQ4RI8WmwR29-jaEFwjt_N1BuHTS9o3OcJUDI",
  bucket: "resumes",
  webUrl: "http://localhost:3000/",
};
const DEFAULT_API_BASE = "http://localhost:3000/api/profile";

let currentProfile = null;
let currentResume = null;
let supaConfig = {
  url: DEFAULT_SUPA.url,
  anonKey: DEFAULT_SUPA.anonKey,
  bucket: DEFAULT_SUPA.bucket,
  email: "",
  apiBase: DEFAULT_API_BASE,
};
let supaSession = null;

function setSbStatus(msg) {
  sbStatus.textContent = msg;
}

function readSupaInputs() {
  supaConfig = {
    url: (sbUrlInput?.value || DEFAULT_SUPA.url).trim().replace(/\/$/, ""),
    anonKey: (sbAnonInput?.value || DEFAULT_SUPA.anonKey).trim(),
    bucket: (sbBucketInput?.value || DEFAULT_SUPA.bucket).trim() || "resumes",
    email: (sbEmailInput.value || "").trim(),
    apiBase: (apiBaseInput?.value || DEFAULT_API_BASE).trim(),
  };
  chrome.storage.local.set({ supaConfig });
}

// On popup open, hydrate config/session/cache
chrome.storage.local.get(
  ["supaConfig", "supaSession", "cachedProfile", "resumeFile"],
  (result) => {
    const cfg = result.supaConfig || supaConfig;
    supaConfig = {
      url: cfg.url || DEFAULT_SUPA.url,
      anonKey: cfg.anonKey || DEFAULT_SUPA.anonKey,
      bucket: cfg.bucket || DEFAULT_SUPA.bucket,
      email: cfg.email || "",
      apiBase: cfg.apiBase || DEFAULT_API_BASE,
    };
    if (sbUrlInput) sbUrlInput.value = supaConfig.url;
    if (sbAnonInput) sbAnonInput.value = supaConfig.anonKey;
    if (sbBucketInput) sbBucketInput.value = supaConfig.bucket;
    if (apiBaseInput) apiBaseInput.value = supaConfig.apiBase;
    sbEmailInput.value = supaConfig.email;

    supaSession = result.supaSession || null;
    currentProfile = result.cachedProfile || null;
    currentResume = result.resumeFile || null;

    if (supaSession) {
      setSbStatus("Session loaded. Fetching profile...");
      fetchSupabaseProfile();
    } else {
      // If no session, still render what we have (e.g. empty state or cached)
      renderProfileUI();
    }
  }
);

// Login and fetch
async function supaLoginAndFetch() {
  readSupaInputs();
  if (!supaConfig.url || !supaConfig.anonKey || !supaConfig.email) {
    setSbStatus("API base/anon key/email required.");
    return;
  }
  const password = sbPasswordInput.value;
  if (!password) {
    setSbStatus("Enter password.");
    return;
  }

  setSbStatus("Logging in...");
  try {
    const res = await fetch(
      `${supaConfig.url}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: supaConfig.anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: supaConfig.email, password }),
      }
    );
    if (!res.ok) {
      const text = await res.text();
      setSbStatus(`Login failed: ${text}`);
      return;
    }
    const data = await res.json();
    supaSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() / 1000 + (data.expires_in || 3600),
      user: data.user,
    };
    chrome.storage.local.set({ supaSession });
    setSbStatus("Logged in. Fetching profile...");
    await fetchSupabaseProfile();
  } catch (e) {
    setSbStatus(`Login error: ${e.message}`);
  }
}

async function fetchSupabaseProfile() {
  if (!supaSession || !supaSession.access_token) {
    setSbStatus("Login first.");
    return;
  }
  readSupaInputs();
  const userId = supaSession.user?.id;
  if (!userId) {
    setSbStatus("No user in session.");
    return;
  }

  // Try central API first
  try {
    const apiRes = await fetch(supaConfig.apiBase || DEFAULT_API_BASE, {
      headers: {
        Authorization: `Bearer ${supaSession.access_token}`,
      },
    });
    if (apiRes.ok) {
      const payload = await apiRes.json();
      const row = payload.profile;
      if (row) {
        const nameParts = (row.full_name || "").trim().split(/\s+/);
        const firstName = nameParts.length ? nameParts[0] : "";
        const lastName =
          nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
        currentProfile = {
          fullName: row.full_name,
          firstName,
          lastName,
          email: row.email,
          phone: row.phone,
          city: row.city,
          state: row.state,
          zip: row.postal,
          country: row.country,
          address: row.address,
          linkedin: row.linkedin_url,
          github: row.github_url,
          portfolio: row.portfolio_url,
          title: row.current_title,
          company: row.current_company,
          password: "",
          confirmPassword: "",
          // Store raw arrays for UI
          experiences: payload.experiences || [],
          educations: payload.educations || [],
          skills: payload.skills || [],
          languages: payload.languages || [],
        };
        chrome.storage.local.set({ cachedProfile: currentProfile });
        setSbStatus("Profile synced from cloud.");
        if (payload.resumeUrl) {
          await fetchSupabaseResumeSigned(payload.resumeUrl, row.resume_path);
        } else if (row.resume_path) {
          await fetchSupabaseResume(row.resume_path);
        }
        // Trigger UI update if function exists
        if (typeof renderProfileUI === "function") renderProfileUI();
        return;
      }
    }
  } catch (e) {
    // continue to fallback
  }

  // Fallback to direct Supabase REST
  try {
    const res = await fetch(
      `${supaConfig.url}/rest/v1/profiles?select=*&id=eq.${userId}`,
      {
        headers: {
          apikey: supaConfig.anonKey,
          Authorization: `Bearer ${supaSession.access_token}`,
          Accept: "application/json",
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      setSbStatus(`Profile fetch failed: ${text}`);
      return;
    }
    const rows = await res.json();
    const row = rows && rows[0];
    if (row) {
      const nameParts = (row.full_name || "").trim().split(/\s+/);
      const firstName = nameParts.length ? nameParts[0] : "";
      const lastName =
        nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
      currentProfile = {
        fullName: row.full_name,
        firstName,
        lastName,
        email: row.email,
        phone: row.phone,
        city: row.city,
        state: row.state,
        zip: row.postal,
        country: row.country,
        address: row.address,
        linkedin: row.linkedin_url,
        github: row.github_url,
        portfolio: row.portfolio_url,
        title: row.current_title,
        company: row.current_company,
        password: "",
        confirmPassword: "",
        experiences: [], // Fallback doesn't fetch these yet
        educations: [],
      };
      chrome.storage.local.set({ cachedProfile: currentProfile });
      setSbStatus("Profile synced from Supabase.");
      if (row.resume_path) {
        await fetchSupabaseResume(row.resume_path);
      }
      if (typeof renderProfileUI === "function") renderProfileUI();
    } else {
      setSbStatus("No profile yet.");
    }
  } catch (e) {
    setSbStatus(`Profile fetch error: ${e.message}`);
  }
}

async function fetchSupabaseResumeSigned(signedUrl, path) {
  if (!signedUrl) return;
  try {
    const res = await fetch(signedUrl);
    if (!res.ok) {
      const text = await res.text();
      setSbStatus(`Resume fetch failed: ${text}`);
      return;
    }
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = () => {
      currentResume = {
        name: path?.split("/").pop() || "resume",
        type: blob.type || "application/octet-stream",
        dataUrl: reader.result,
        lastModified: Date.now(),
      };
      chrome.storage.local.set({ resumeFile: currentResume }, () => {
        setSbStatus("Resume synced from cloud.");
      });
    };
    reader.readAsDataURL(blob);
  } catch (e) {
    setSbStatus(`Resume fetch error: ${e.message}`);
  }
}

async function fetchSupabaseResume(path) {
  if (!path) return;
  try {
    const res = await fetch(
      `${supaConfig.url}/storage/v1/object/${supaConfig.bucket}/${path}`,
      {
        headers: {
          apikey: supaConfig.anonKey,
          Authorization: `Bearer ${supaSession.access_token}`,
        },
      }
    );
    if (!res.ok) {
      const text = await res.text();
      setSbStatus(`Resume fetch failed: ${text}`);
      return;
    }
    const blob = await res.blob();
    const reader = new FileReader();
    reader.onload = () => {
      currentResume = {
        name: path.split("/").pop() || "resume",
        type: blob.type || "application/octet-stream",
        dataUrl: reader.result,
        lastModified: Date.now(),
      };
      chrome.storage.local.set({ resumeFile: currentResume }, () => {
        setSbStatus("Resume synced from Supabase.");
      });
    };
    reader.readAsDataURL(blob);
  } catch (e) {
    setSbStatus(`Resume fetch error: ${e.message}`);
  }
}

// Autofill click
fillBtn.addEventListener("click", () => {
  if (!currentProfile || Object.keys(currentProfile).length === 0) {
    statusEl.textContent = "Fetch your profile first.";
    return;
  }
  const resume = currentResume || null;
  statusEl.textContent = "Sending autofill…";
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) {
      statusEl.textContent = "No active tab.";
      return;
    }
    const tab = tabs[0];
    const isHttp = tab.url && /^https?:/i.test(tab.url);
    if (!isHttp) {
      statusEl.textContent = "Open a normal https:// page to autofill.";
      return;
    }
    // Ensure content script is present, then send message
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        files: ["content.js"],
      },
      () => {
        // Ignore injection errors; send message anyway
        chrome.tabs.sendMessage(
          tab.id,
          {
            type: "FILL_FORM",
            profile: currentProfile,
            resume,
          },
          () => {
            const err = chrome.runtime.lastError;
            if (err) {
              statusEl.textContent = `Autofill failed: ${err.message}`;
            } else {
              statusEl.textContent = "Autofill sent.";
              setTimeout(() => (statusEl.textContent = ""), 1500);
            }
          }
        );
      }
    );
  });
});

sbLoginBtn.addEventListener("click", () => {
  supaLoginAndFetch();
});

openWebBtn.addEventListener("click", () => {
  const target = DEFAULT_SUPA.webUrl || "http://localhost:3000/";
  chrome.tabs.create({ url: target });
});

function renderProfileUI() {
  if (!currentProfile) {
    profileView.style.display = "none";
    loginView.style.display = "block";
    if (userInitialsEl) userInitialsEl.textContent = "";
    return;
  }

  // Show profile view
  profileView.style.display = "block";
  loginView.style.display = "none";

  // Header Initials
  if (userInitialsEl) {
    const initials = (currentProfile.fullName || "")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    userInitialsEl.textContent = initials;
  }

  // Personal Info
  if (dispName) dispName.textContent = currentProfile.fullName || "—";
  if (dispEmail) dispEmail.textContent = currentProfile.email || "—";
  if (dispPhone) dispPhone.textContent = currentProfile.phone || "—";
  if (dispLoc) {
    const loc = [currentProfile.city, currentProfile.country]
      .filter(Boolean)
      .join(", ");
    dispLoc.textContent = loc || "—";
  }

  // Links
  const setLink = (el, url) => {
    if (el) {
      if (url) {
        el.href = url;
        el.style.display = "inline";
        el.textContent = "View";
      } else {
        el.style.display = "none";
      }
    }
  };
  setLink(linkLi, currentProfile.linkedin);
  setLink(linkGh, currentProfile.github);
  setLink(linkPort, currentProfile.portfolio);

  // Work Experience
  if (expList) {
    // Clear existing items except title
    const title = expList.querySelector(".section-title");
    expList.innerHTML = "";
    if (title) expList.appendChild(title);

    const exps = currentProfile.experiences || [];
    if (exps.length === 0) {
      const empty = document.createElement("div");
      empty.style.textAlign = "center";
      empty.style.color = "var(--text-secondary)";
      empty.style.padding = "10px";
      empty.textContent = "No experience found.";
      expList.appendChild(empty);
    } else {
      exps.forEach((exp) => {
        const item = document.createElement("div");
        item.className = "work-item";

        const role = document.createElement("div");
        role.className = "work-role";
        role.textContent = exp.job_title || "Role";

        const company = document.createElement("div");
        company.className = "work-company";
        company.textContent = exp.company_name || "Company";

        const date = document.createElement("div");
        date.className = "work-date";
        const start = `${exp.start_month || ""} ${exp.start_year || ""}`.trim();
        const end = exp.is_current
          ? "Present"
          : `${exp.end_month || ""} ${exp.end_year || ""}`.trim();
        date.textContent = start || end ? `${start} – ${end}` : "";

        item.appendChild(role);
        item.appendChild(company);
        item.appendChild(date);
        expList.appendChild(item);
      });
    }
  }

  // Education
  if (eduList) {
    // Clear existing items except title
    const title = eduList.querySelector(".section-title");
    eduList.innerHTML = "";
    if (title) eduList.appendChild(title);

    const edus = currentProfile.educations || [];
    if (edus.length === 0) {
      const empty = document.createElement("div");
      empty.style.textAlign = "center";
      empty.style.color = "var(--text-secondary)";
      empty.style.padding = "10px";
      empty.textContent = "No education found.";
      eduList.appendChild(empty);
    } else {
      edus.forEach((edu) => {
        const item = document.createElement("div");
        item.className = "work-item";

        const degree = document.createElement("div");
        degree.className = "work-role";
        degree.textContent = edu.degree_type
          ? `${edu.degree_type} ${edu.major ? "• " + edu.major : ""}`
          : edu.major || "Degree";

        const school = document.createElement("div");
        school.className = "work-company";
        school.textContent = edu.school_name || "School";

        const date = document.createElement("div");
        date.className = "work-date";
        const start = edu.start_year || "";
        const end = edu.end_year || "";
        date.textContent = start || end ? `${start} – ${end}` : "";

        item.appendChild(degree);
        item.appendChild(school);
        item.appendChild(date);
        eduList.appendChild(item);
      });
    }
  }
}
