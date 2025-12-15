(function () {
  // Prevent re-declaration issues by checking if we've already run
  if (window.hasJobFillerContentScript) return;
  window.hasJobFillerContentScript = true;

  // Utility: check if an input/textarea matches a key
  function fieldMatches(input, keywords) {
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const placeholder = (input.placeholder || "").toLowerCase();
    const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();
    const dataLabel = (input.getAttribute("data-label") || "").toLowerCase();
    const dataTestId = (input.getAttribute("data-testid") || "").toLowerCase();

    // Resolve aria-labelledby
    const ariaLabelledBy = input.getAttribute("aria-labelledby");
    let ariaLabelledText = "";
    if (ariaLabelledBy) {
      ariaLabelledText = ariaLabelledBy.split(/\s+/).map(id => document.getElementById(id)?.innerText || "").join(" ");
    }

    const labelText = (
      input.closest("label")?.innerText ||
      input.parentElement?.querySelector("label")?.innerText ||
      ariaLabelledText ||
      Array.from(input.labels || [])
        .map((l) => l.innerText)
        .join(" ") ||
      ""
    ).toLowerCase();

    const autocomplete = (input.autocomplete || input.getAttribute("autocomplete") || "").toLowerCase();

    return keywords.some((kw) => {
      if (!kw) return false;
      kw = kw.toLowerCase();
      // Strict match for autocomplete
      if (autocomplete === kw || (autocomplete.includes(kw) && kw.length > 3)) return true;

      return (
        name.includes(kw) ||
        id.includes(kw) ||
        placeholder.includes(kw) ||
        ariaLabel.includes(kw) ||
        dataLabel.includes(kw) ||
        dataTestId.includes(kw) ||
        labelText.includes(kw)
      );
    });
  }

  function setNativeValue(element, value) {
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

    if (valueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else {
      valueSetter.call(element, value);
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function setValue(input, value) {
    if (!value) return false;

    if (input.isContentEditable) {
      input.textContent = value;
    } else {
      // Try standard way first
      input.value = value;
      // Also try native setter for React/Angular
      try {
        setNativeValue(input, value);
      } catch (e) {
        // ignore
      }
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    input.dispatchEvent(new Event("focus", { bubbles: true }));
    return true;
  }

  function normalize(text) {
    return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function visible(element) {
    return (
      element &&
      element.offsetParent !== null &&
      getComputedStyle(element).visibility !== "hidden" &&
      getComputedStyle(element).display !== "none"
    );
  }

  function setCheckbox(input, checked) {

    if (input.type !== "checkbox") return false;
    input.checked = checked;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function formatMonthYear(month, year) {
    if (!month || !year) return "";
    const mm = String(month).padStart(2, "0");
    return `${mm}/${year}`;
  }

  function setTextDateIfNeeded(input, value) {
    if (!value) return false;
    const placeholder = (input.placeholder || "").toLowerCase();
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const label = (
      input.closest("label")?.innerText ||
      input.parentElement?.querySelector("label")?.innerText ||
      ""
    ).toLowerCase();
    const isDateLike =
      placeholder.includes("mm") ||
      placeholder.includes("yyyy") ||
      name.includes("mm") ||
      id.includes("mm") ||
      label.includes("mm");
    if (!isDateLike) return false;
    return setValue(input, value);
  }

  let lastAutoClick = 0;

  // Auto-submit feature is disabled.

  function keepFilling(profile) {
    const observer = new MutationObserver(() => {
      fillForm(profile, { silentClick: true });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => observer.disconnect(), 8000);
  }

  function dataUrlToFile(resume) {
    if (!resume || !resume.dataUrl) return null;
    const matches = resume.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return null;

    const mime = matches[1] || "application/octet-stream";
    const b64 = matches[2];
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new File([bytes], resume.name || "resume", {
      type: mime,
      lastModified: resume.lastModified || Date.now(),
    });
  }

  function setFileInput(input, file) {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  async function tryCustomDropdown(keywords, variants, allowFallback = false) {
    const dropdowns = Array.from(
      document.querySelectorAll(
        `select, [role='combobox'], [aria-haspopup='listbox'], [aria-haspopup='true'],
         [data-testid*='select'], button[aria-expanded], .dropdown-toggle,
         .select, .Select, [data-selectable], [class*='select'], [class*='dropdown']`
      )
    ).filter(visible);

    const matchesKw = (el) => fieldMatches(el, keywords);

    for (const dd of dropdowns) {
      if (!matchesKw(dd)) continue;

      try {
        dd.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        dd.click();
        dd.focus();
      } catch (_) { }

      // WAIT for options to appear (modern dropdowns load asynchronously)
      await new Promise(r => setTimeout(r, 600));

      // Gather options
      let options = [];
      if (dd.tagName === 'SELECT') {
        // Refresh options from DOM in case they were lazy loaded
        options = Array.from(dd.children).filter(c => c.tagName === 'OPTION');
        if (options.length === 0) options = Array.from(dd.options);
      }

      // Also look for custom options in document (for custom dropdowns)
      const customOptions = Array.from(
        document.querySelectorAll(
          `[role='option'], li:not([role='presentation']), 
           [data-testid*='option'], .option, .Select-option,
           [class*='option'], [class*='item'], ul li`
        )
      ).filter(visible);

      options = options.concat(customOptions);

      const isPlaceholder = (text) => {
        const t = (text || "").toLowerCase().trim();
        return (
          !t ||
          t === "select" ||
          t === "please select" ||
          t === "choose" ||
          t === "none" ||
          t === "select an option" ||
          t.includes("----") ||
          t === "..."
        );
      };

      // Try exact and fuzzy matches
      for (const opt of options) {
        const text = (opt.innerText || opt.textContent || "").trim();
        if (!text || isPlaceholder(text)) continue;

        const textLower = text.toLowerCase();
        // Skip placeholder values sometimes hidden in options
        if (textLower === "select..." || textLower === "select") continue;

        for (const v of variants) {
          const norm = (v || "").toString().toLowerCase().trim();
          if (!norm) continue;

          // Exact match
          if (textLower === norm) {
            try {
              if (dd.tagName === 'SELECT') {
                dd.value = opt.value;
                dd.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                opt.click();
              }
              return true;
            } catch (_) { continue; }
          }

          // Contains match
          if (textLower.includes(norm) || norm.includes(textLower)) {
            try {
              if (dd.tagName === 'SELECT') {
                dd.value = opt.value;
                dd.dispatchEvent(new Event('change', { bubbles: true }));
              } else {
                opt.click();
              }
              return true;
            } catch (_) { continue; }
          }
        }
      }

      if (allowFallback) {
        const fallback = options.find((opt) => {
          const txt = (opt.innerText || opt.textContent || "").trim();
          return txt && !isPlaceholder(txt);
        });
        if (fallback) {
          try {
            if (dd.tagName === 'SELECT') {
              dd.value = fallback.value;
              dd.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              fallback.click();
            }
            return true;
          } catch (_) {
            /* ignore */
          }
        }
      }
    }
    return false;
  }

  async function fillSkillsOneByOne(input, skills) {
    if (!skills || !skills.length) return;

    // Limit to top 20 skills as requested
    const skillsToFill = skills.slice(0, 20);

    input.focus();

    for (const skill of skillsToFill) {
      const skillName = typeof skill === 'string' ? skill : skill.skill_name;
      if (!skillName) continue;

      // 1. Type the skill
      setValue(input, skillName);
      input.dispatchEvent(new Event('input', { bubbles: true }));

      // 2. Wait for dropdown results (simulated delay)
      await new Promise(r => setTimeout(r, 500));

      // 3. Try to find and click a matching option in a dropdown
      // Look for common dropdown containers or options visible in the DOM
      const options = Array.from(document.querySelectorAll("li, div[role='option'], .option, .dropdown-item, [data-testid*='option']"))
        .filter(visible);

      let clicked = false;
      const normSkill = normalize(skillName);

      for (const opt of options) {
        const text = normalize(opt.innerText || opt.textContent || "");
        // Exact match or match with checkbox label
        if (text === normSkill || text === normalize(skillName)) {
          try {
            // Check if it has a checkbox
            const checkbox = opt.querySelector("input[type='checkbox']");
            if (checkbox && !checkbox.checked) {
              checkbox.click();
            } else {
              opt.click();
            }
            clicked = true;
            break;
          } catch (e) { }
        }
      }

      if (!clicked) {
        // Fallback: Press Enter
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
      }

      // 4. Clear input for next skill if needed (if it didn't clear automatically)
      // We wait a bit to see if the UI reacts
      await new Promise(r => setTimeout(r, 300));
      if (input.value && input.value.toLowerCase().includes(skillName.toLowerCase())) {
        setValue(input, "");
      }
    }
  }

  function checkAndClickAddButtons(profile) {
    const safeProfile = profile || {};
    const experiences = safeProfile.experiences || [];
    const educations = safeProfile.educations || [];

    const clickAddForSection = (keywords, itemType) => {
      // 1. Find the section container
      // Workday structure: <div role="group" aria-labelledby="Work-Experience-section">
      const groups = Array.from(document.querySelectorAll("div[role='group']")).filter(visible);

      let targetGroup = null;

      for (const group of groups) {
        // Check aria-labelledby
        const labelledBy = group.getAttribute("aria-labelledby");
        if (labelledBy) {
          const header = document.getElementById(labelledBy);
          if (header && keywords.some(kw => (header.innerText || "").toLowerCase().includes(kw))) {
            targetGroup = group;
            break;
          }
        }

        // Check internal headers if no aria-labelledby match
        if (!targetGroup) {
          const headers = Array.from(group.querySelectorAll("h1, h2, h3, h4, h5, h6, legend"))
            .filter(el => visible(el) && keywords.some(kw => (el.innerText || "").toLowerCase().includes(kw)));
          if (headers.length > 0) {
            targetGroup = group;
            break;
          }
        }
      }

      if (!targetGroup) return false;

      // 2. Count existing items in this group
      // We look for sub-groups or sets of inputs that define an item.
      // In Workday, items are often in <div class="css-1ebprri"> or similar, but let's rely on input counts.
      const inputs = Array.from(targetGroup.querySelectorAll("input:not([type='hidden']), select, textarea")).filter(visible);

      let visibleCount = 0;
      if (itemType === 'work') {
        // Count unique sets of "Company" or "Title" fields
        // A simple heuristic: count the number of "Company" fields
        const companies = inputs.filter(i => fieldMatches(i, ["company", "employer", "organization"]));
        const titles = inputs.filter(i => fieldMatches(i, ["title", "role", "position"]));
        // If we find 0, maybe they are not labeled standardly. 
        // Let's try to count "Add" buttons? No, we want to count FORMS.
        // If 0 inputs found, maybe the form isn't open yet?
        visibleCount = Math.max(companies.length, titles.length);
      } else if (itemType === 'education') {
        const schools = inputs.filter(i => fieldMatches(i, ["school", "university", "college", "institution"]));
        const degrees = inputs.filter(i => fieldMatches(i, ["degree", "qualification"]));
        visibleCount = Math.max(schools.length, degrees.length);
      }

      const needed = itemType === 'work' ? experiences.length : educations.length;

      // 3. If we need more, find the Add button IN THIS GROUP and click it
      if (visibleCount < needed && needed > 0) {
        // Look for the specific Add button
        // Workday: <button data-automation-id="add-button">Add</button>
        const buttons = Array.from(targetGroup.querySelectorAll("button, div[role='button']")).filter(visible);
        const addButton = buttons.find(btn => {
          const txt = (btn.innerText || "").toLowerCase();
          const testId = (btn.getAttribute("data-automation-id") || "").toLowerCase();
          return (txt === "add" || txt === "add another" || testId === "add-button");
        });

        if (addButton) {
          addButton.click();
          return true; // We clicked, so return true to trigger a retry
        }
      }

      return false;
    };

    let clicked = false;
    // Prioritize Work Experience
    if (clickAddForSection(["work experience", "employment history"], 'work')) clicked = true;
    // Only click one at a time to allow UI to update
    if (!clicked && clickAddForSection(["education", "academic history"], 'education')) clicked = true;

    return clicked;
  }

  async function fillForm(profile) {
    // console.log("ANTIGRAVITY: Filling Form with Profile:", Object.keys(profile));

    // Polyfill First/Last name if missing
    if (profile.fullName && !profile.firstName) {

      const parts = profile.fullName.trim().split(/\s+/);
      profile.firstName = parts[0];
      profile.lastName = parts.slice(1).join(" ");
    }
    if (!profile.firstName && profile.first_name) profile.firstName = profile.first_name;
    if (!profile.lastName && profile.last_name) profile.lastName = profile.last_name;
    // Check if we need to expand sections first
    if (checkAndClickAddButtons(profile)) {
      setTimeout(() => fillForm(profile), 1000);
      return;
    }

    const safeProfile = profile || {};
    const exp0 = (safeProfile.experiences && safeProfile.experiences[0]) || {};
    const edu0 = (safeProfile.educations && safeProfile.educations[0]) || {};

    // TRY CUSTOM DROPDOWNS FIRST (for modern React/Angular forms)
    // Country
    if (safeProfile.country) {
      await tryCustomDropdown(
        ["country"],
        [safeProfile.country, "united states", "usa", "us", "america", "united states of america"]
      );
    }

    // State
    if (safeProfile.state) {
      await tryCustomDropdown(
        ["state", "province", "region"],
        [safeProfile.state]
      );
    }

    // --- JOB PREFERENCES & EEO ---

    // Source / Hear About
    if (safeProfile.question_hear_about) {
      await tryCustomDropdown(
        ["how did you hear", "source", "hear about"],
        [safeProfile.question_hear_about, "LinkedIn", "Other"],
        true
      );
    } else {
      await tryCustomDropdown(["how did you hear", "source"], ["LinkedIn", "Other"], true);
    }

    // Used Product
    if (safeProfile.question_used_product) {
      await tryCustomDropdown(
        ["used robinhood", "used our product", "product"],
        [safeProfile.question_used_product],
        true
      );
    }

    // Work Authorization
    const authVal = safeProfile.question_work_auth || "Yes";
    await tryCustomDropdown(
      ["legally authorized", "authorized to work", "work authorization"],
      [authVal, "i am authorized"],
      true
    );

    // Sponsorship
    const sponsorVal = safeProfile.question_sponsorship || "No";
    await tryCustomDropdown(
      ["sponsorship", "require sponsorship", "visa sponsorship"],
      [sponsorVal, "i do not require"],
      true
    );

    // Relocation
    await tryCustomDropdown(
      ["relocation", "willing to relocate", "open to relocation", "office location"],
      ["yes", "true", "wa", "seattle"],
      true
    );

    // Worked Before
    if (safeProfile.question_worked_before) {
      await tryCustomDropdown(
        ["worked for", "previous employment", "worked here before", "intern", "contractor"],
        [safeProfile.question_worked_before],
        true
      );
    }

    // Pronouns
    if (safeProfile.question_pronouns) {
      await tryCustomDropdown(
        ["pronouns"],
        [safeProfile.question_pronouns],
        true
      );
    }

    // Gender
    if (safeProfile.question_gender) {
      await tryCustomDropdown(
        ["gender"],
        [safeProfile.question_gender],
        true
      );
    }

    // LGBTQ
    if (safeProfile.question_lgbtq) {
      await tryCustomDropdown(
        ["lgbtq", "sexual orientation"],
        [safeProfile.question_lgbtq],
        true
      );
    }

    // Military
    if (safeProfile.question_military_status) {
      await tryCustomDropdown(
        ["military", "veteran"],
        [safeProfile.question_military_status],
        true
      );
    }

    // Conflict of Interest
    await tryCustomDropdown(
      ["conflict of interest", "relationships", "outside business"],
      [safeProfile.question_conflict_interest || "No"],
      true
    );


    // Gov Official
    await tryCustomDropdown(
      ["government official", "corruption"],
      [safeProfile.question_gov_official || "No"],
      true
    );

    await tryCustomDropdown(
      ["background check", "submit to background"],
      ["yes", "y", "true", "acknowledge", "confirm"],
      true
    );

    const degree = (edu0.degree_type || safeProfile.degree || "").trim() || "Bachelor";
    await tryCustomDropdown(
      ["education level", "highest level", "level of education"],
      [degree, "bachelor", "bachelors", "bachelor's degree"],
      true
    );

    const inputs = Array.from(
      document.querySelectorAll("input, textarea, select, [contenteditable='true']")
    );

    const defaultAnswers = {
      source: "LinkedIn",
      fromDate:
        formatMonthYear(exp0.start_month || safeProfile.start_month, exp0.start_year || safeProfile.start_year) ||
        "01/2022",
      toDate:
        formatMonthYear(exp0.end_month || safeProfile.end_month, exp0.end_year || safeProfile.end_year) ||
        (exp0.is_current || safeProfile.is_current ? "" : "12/2023"),
      degree: (edu0.degree_type || safeProfile.degree || "").trim() || "Bachelor",
      major: (edu0.major || safeProfile.major || "").trim() || "Computer Science",
      password: safeProfile.password || safeProfile.confirmPassword || "P@ssword123!",
      startMonth: exp0.start_month || safeProfile.start_month || "",
      startYear: exp0.start_year || safeProfile.start_year || "",
      endMonth: exp0.end_month || safeProfile.end_month || "",
      endYear: exp0.end_year || safeProfile.end_year || "",
    };

    const monthVariants = (val) => {
      if (!val) return [];
      const monthNames = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];
      const lower = String(val).toLowerCase();
      const idx = monthNames.findIndex((m) => m.startsWith(lower));
      const num = idx >= 0 ? idx + 1 : parseInt(val, 10);
      if (!num || Number.isNaN(num)) return [];
      const mm = String(num).padStart(2, "0");
      const name = monthNames[num - 1];
      const abbr = name?.slice(0, 3);
      const cap = name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
      const capAbbr = abbr ? abbr.charAt(0).toUpperCase() + abbr.slice(1) : "";
      return [mm, name, abbr, cap, capAbbr, String(num)].filter(Boolean);
    };

    const degreeVariants = (val) => {
      if (!val) return [];
      const lower = normalize(val);

      const masters = [
        "masters",
        "master",
        "mastersdegree",
        "masterdegree",
        "masterscience",
        "masterofscience",
        "ms",
        "mscs",
        "mcs",
        "msc",
        "meng",
        "mengg",
        "mtech",
        "mtech",
        "m.s",
        "m.scs",
        "m.sc",
        "masterofengineering",
        "masteroftechnology",
      ];
      const bachelors = [
        "bachelors",
        "bachelor",
        "bachelorsdegree",
        "bachelordegree",
        "bachelorscience",
        "bachelorofscience",
        "bs",
        "bsc",
        "btech",
        "btech",
        "b.eng",
        "beng",
        "bachelorofengineering",
        "bacheloroftechnology",
      ];
      const matchesList = (list) =>
        list.some((item) => lower === item || lower.includes(item));

      if (matchesList(masters)) return masters;
      if (matchesList(bachelors)) return bachelors;
      return [val];
    };

    // Convert to sequential loop to prevent UI race conditions
    for (const input of inputs) {
      // Allow file inputs even if hidden (often styled with custom buttons)
      if (!visible(input) && input.type !== 'file') continue;

      // Previous Employment / Current Employee Questions -> Default NO
      if (input.type === 'radio' || input.tagName === 'SELECT') {
        const question = (
          input.closest("fieldset")?.querySelector("legend")?.innerText ||
          input.closest("div[role='group']")?.querySelector("h3, h4, label")?.innerText ||
          input.closest("div")?.innerText ||
          ""
        ).toLowerCase();

        const keywords = ["previously worked", "worked for", "current employee", "currently work for", "employment history at", "have you ever worked", "previous associate", "current associate"];
        if (keywords.some(kw => question.includes(kw))) {
          // It's a relevant question. Try to select "No".
          if (input.tagName === 'SELECT') {
            // Try to find "No" option
            let setNo = false;
            for (const opt of input.options) {
              const txt = (opt.text || "").toLowerCase();
              if (txt === "no" || txt === "false") {
                input.value = opt.value;
                input.dispatchEvent(new Event("change", { bubbles: true }));
                setNo = true;
                break;
              }
            }
            if (setNo) continue;
          } else if (input.type === 'radio') {
            const label = (input.nextElementSibling?.innerText || input.parentElement?.innerText || "").toLowerCase();
            const val = (input.value || "").toLowerCase();
            if (label.includes("no") || val === "no" || val === "false" || val === "0") {
              input.click();
              continue;
            }
          }
        }
      }

      // Preferred Language -> Default English
      if ((input.type === 'radio' || input.tagName === 'SELECT') && fieldMatches(input, ["preferred language", "language of communication", "language"])) {
        if (input.tagName === 'SELECT') {
          // Select English
          for (const opt of input.options) {
            const txt = (opt.text || "").toLowerCase();
            if (txt.includes("english")) {
              input.value = opt.value;
              input.dispatchEvent(new Event("change", { bubbles: true }));
              break;
            }
          }
        } else if (input.type === 'radio') {
          const label = (input.nextElementSibling?.innerText || input.parentElement?.innerText || "").toLowerCase();
          const val = (input.value || "").toLowerCase();
          if (label.includes("english") || val === "english" || val === "en") {
            input.click();
            continue;
          }
        }
      }

      if (input.tagName === "SELECT") {
        // Handle dropdowns
        const select = input;

        // Lazy load support: Click and wait (aggressive)
        try {
          select.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          select.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          select.click();
          select.focus();
        } catch (e) { }

        await new Promise(r => setTimeout(r, 600));

        const trySelect = (val) => {
          if (!val) return false;
          const normTarget = normalize(val);
          for (const opt of Array.from(select.options)) {
            if (!opt.value && !opt.textContent) continue;
            const text = (opt.textContent || "").trim();
            const value = (opt.value || "").trim();
            const normText = normalize(text);
            const normValue = normalize(value);
            if (normText === normTarget || normValue === normTarget) {
              // React 16+ Overrides "value" setter, so use setNativeValue logic
              try {
                setNativeValue(select, opt.value);
              } catch (e) {
                select.value = opt.value;
              }
              select.dispatchEvent(new Event("input", { bubbles: true }));
              select.dispatchEvent(new Event("change", { bubbles: true }));
              select.dispatchEvent(new Event("blur", { bubbles: true }));
              return true;
            }
          }
          // fallback partial match
          for (const opt of Array.from(select.options)) {
            const text = (opt.textContent || "").trim();
            const normText = normalize(text);
            if (normText.includes(normTarget)) {
              try {
                setNativeValue(select, opt.value);
              } catch (e) {
                select.value = opt.value;
              }
              select.dispatchEvent(new Event("input", { bubbles: true }));
              select.dispatchEvent(new Event("change", { bubbles: true }));
              select.dispatchEvent(new Event("blur", { bubbles: true }));
              return true;
            }
          }
          return false;
        };

        const trySelectVariants = (val, variants = []) => {
          if (trySelect(val)) return true;
          for (const v of variants) {
            if (trySelect(v)) return true;
          }
          return false;
        };

        const stateMap = {
          alabama: "al",
          alaska: "ak",
          arizona: "az",
          arkansas: "ar",
          california: "ca",
          colorado: "co",
          connecticut: "ct",
          delaware: "de",
          florida: "fl",
          georgia: "ga",
          hawaii: "hi",
          idaho: "id",
          illinois: "il",
          indiana: "in",
          iowa: "ia",
          kansas: "ks",
          kentucky: "ky",
          louisiana: "la",
          maine: "me",
          maryland: "md",
          massachusetts: "ma",
          michigan: "mi",
          minnesota: "mn",
          mississippi: "ms",
          missouri: "mo",
          montana: "mt",
          nebraska: "ne",
          nevada: "nv",
          newhampshire: "nh",
          newjersey: "nj",
          newmexico: "nm",
          newyork: "ny",
          northcarolina: "nc",
          northdakota: "nd",
          ohio: "oh",
          oklahoma: "ok",
          oregon: "or",
          pennsylvania: "pa",
          rhodeisland: "ri",
          southcarolina: "sc",
          southdakota: "sd",
          tennessee: "tn",
          texas: "tx",
          utah: "ut",
          vermont: "vt",
          virginia: "va",
          washington: "wa",
          westvirginia: "wv",
          wisconsin: "wi",
          wyoming: "wy",
          "district of columbia": "dc",
        };
        if (fieldMatches(select, ["degree", "education level", "qualification"])) {
          const variants = degreeVariants(defaultAnswers.degree);
          if (trySelectVariants(defaultAnswers.degree, variants)) return;

          // Improved Fallback: Try to match any word in the degree string
          const degreeWords = defaultAnswers.degree.toLowerCase().split(/\s+/).filter(w => w.length > 3);
          for (const word of degreeWords) {
            if (trySelectVariants(word, [word])) return;
          }

          // Final fallback: first non-placeholder option
          const fallback = Array.from(select.options).find((o) => {
            const t = (o.textContent || "").toLowerCase();
            return o.value || (t && !t.includes("select") && !t.includes("choose") && !t.includes("none"));
          });
          if (fallback) {
            select.value = fallback.value;
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
            return;
          }
        }
        if (fieldMatches(select, ["field of study", "major", "program"])) {
          if (trySelectVariants(defaultAnswers.major, [defaultAnswers.major])) return;
          const fallback = Array.from(select.options).find((o) => {
            const t = (o.textContent || "").toLowerCase();
            return o.value || (t && !t.includes("select") && !t.includes("choose") && !t.includes("none"));
          });
          if (fallback) {
            select.value = fallback.value;
            select.dispatchEvent(new Event("input", { bubbles: true }));
            select.dispatchEvent(new Event("change", { bubbles: true }));
            return;
          }
        }

        // Source
        if (
          fieldMatches(select, [
            "how did you hear",
            "heard about",
            "source",
            "recruiting source",
            "referral source",
            "application source",
          ])
        ) {
          if (trySelect(defaultAnswers.source)) continue;
        }

        continue;
      }

      // Skills Input - Loop through skills
      if (fieldMatches(input, ["skills", "skill", "technologies", "keywords"])) {
        if (safeProfile.skills && Array.isArray(safeProfile.skills) && safeProfile.skills.length > 0) {
          // Only try to fill if empty or looks like a search box
          if (!input.value) {
            // Fill skills one by one
            await fillSkillsOneByOne(input, safeProfile.skills);
            continue;
          }
        }
      }

      if (input.type === "checkbox") {
        // Agree / Consent / Privacy / SMS
        const label = (input.closest("label")?.innerText || input.nextElementSibling?.innerText || input.parentElement?.innerText || "").toLowerCase();
        const agreeKeywords = ["agree", "consent", "acknowledge", "privacy", "policy", "communications", "sms", "text message", "updates", "certify", "declare", "confirm"];
        if (agreeKeywords.some(kw => label.includes(kw))) {
          setCheckbox(input, true);
          continue;
        }

        // Demographic Questions (Gender, Race, Veteran, etc.)
        const groupLabel = (
          input.closest(".form-group")?.querySelector("label.control-label")?.innerText ||
          input.closest("fieldset")?.querySelector("legend")?.innerText ||
          input.closest(".field")?.querySelector("label")?.innerText ||
          ""
        ).toLowerCase();

        let isDemographicMatch = false;
        const pGender = (profile.gender || "").toLowerCase();
        const pRace = (profile.race || "").toLowerCase();
        const pVeteran = (profile.veteran || "").toLowerCase();
        const pDisability = (profile.disability || "").toLowerCase();

        if (groupLabel.includes("gender")) {
          if (label === pGender) isDemographicMatch = true;
          if ((label === "man" || label === "male") && pGender.startsWith("m")) isDemographicMatch = true;
          if ((label === "woman" || label === "female") && pGender.startsWith("f")) isDemographicMatch = true;
          if (label.includes("non-binary") && pGender.includes("non-binary")) isDemographicMatch = true;
        } else if (groupLabel.includes("race") || groupLabel.includes("ethnicity") || groupLabel.includes("racial") || groupLabel.includes("origin")) {
          if (label === pRace) isDemographicMatch = true;
          if (pRace.includes("asian") && label.includes("asian")) isDemographicMatch = true;
          if (pRace.includes("black") && (label.includes("black") || label.includes("african"))) isDemographicMatch = true;
          if (pRace.includes("hispanic") && (label.includes("hispanic") || label.includes("latin") || label.includes("spanish"))) isDemographicMatch = true;
          if (pRace.includes("white") && (label.includes("white") || label.includes("caucasian") || label.includes("european"))) isDemographicMatch = true;
        } else if (groupLabel.includes("sexual orientation")) {
          const pSexOrient = (profile.lgbtq || "").toLowerCase();
          if (pSexOrient === "yes" && !label.includes("straight") && !label.includes("heterosexual")) {
            const pOrient = (profile.sexual_orientation || "").toLowerCase();
            if (pOrient && label.includes(pOrient)) isDemographicMatch = true;
          }
        } else if (groupLabel.includes("veteran") || groupLabel.includes("military")) {
          if (label === pVeteran) isDemographicMatch = true;
          if (pVeteran === "yes" && label.includes("identify as one")) isDemographicMatch = true;
          if ((pVeteran === "no" || pVeteran === "not a veteran" || pVeteran === "notaveteran") && (label.includes("not") || label.includes("no "))) isDemographicMatch = true;
        } else if (groupLabel.includes("disability")) {
          if (label === pDisability) isDemographicMatch = true;
          if (pDisability === "yes" && label.includes("yes")) isDemographicMatch = true;
        }

        if (isDemographicMatch) {
          setCheckbox(input, true);
          continue;
        }

        // Currently working here
        if (fieldMatches(input, ["currently", "current", "i currently work"]) || fieldMatches(input, ["present"])) {
          const isCurrent = profile.is_current !== false; // default to true if unknown
          setCheckbox(input, isCurrent);

          // If checked, try to clear End Date inputs if they exist nearby or globally
          if (isCurrent) {
            const endInputs = Array.from(document.querySelectorAll("input, select")).filter(el =>
              fieldMatches(el, ["end date", "to date", "end year", "end month"])
            );
            endInputs.forEach(el => {
              if (el.tagName === "SELECT") el.value = "";
              else el.value = "";
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            });
          }
          continue;
        }
      }

      const existing = (input.value || "").trim().toLowerCase();
      const looksLikePlaceholder = existing.includes("current value");
      const isPasswordField = fieldMatches(input, ["password", "verify password", "confirm password", "passcode"]);
      const isDateField = fieldMatches(input, ["from", "to", "start", "end", "mm/yyyy"]);

      // Resume Upload
      if (input.type === "file") {
        // Check for existing file
        const container = input.closest("div[role='group']") || input.closest("div") || document.body;
        const hasExisting = Array.from(container.querySelectorAll("div, span, p")).some(el =>
          (el.innerText || "").includes("Successfully Uploaded") ||
          el.getAttribute("data-automation-id") === "file-upload-successful" ||
          el.querySelector("button[data-automation-id='delete-file']")
        );

        if (hasExisting) continue; // Skip if already uploaded

        if (profile.resume) {
          const file = dataUrlToFile(profile.resume);
          if (file) setFileInput(input, file);
        }
        continue;
      }

      if (existing && !looksLikePlaceholder && !isPasswordField && !isDateField) continue;
      if (input.type === "hidden") continue;

      // Full name
      if (
        fieldMatches(input, ["full name", "name", "candidate name"]) &&
        profile.fullName
      ) {
        setValue(input, profile.fullName);
        continue;
      }

      // First name
      if (
        fieldMatches(input, ["first name", "given name", "fname", "first", "given-name"]) &&
        profile.firstName
      ) {
        setValue(input, profile.firstName);
        continue;
      }

      // Last name
      if (
        fieldMatches(input, ["last name", "surname", "family name", "lname", "family-name"]) &&
        profile.lastName
      ) {
        setValue(input, profile.lastName);
        continue;
      }

      // Email
      if (
        fieldMatches(input, ["email", "e-mail"]) &&
        profile.email &&
        input.type !== "password"
      ) {
        setValue(input, profile.email);
        continue;
      }

      // Phone
      if (fieldMatches(input, ["phone", "mobile", "contact", "tel", "tel-national"]) && profile.phone) {
        setValue(input, profile.phone);
        continue;
      }

      // City / Location
      if (
        fieldMatches(input, ["city", "location", "current city"]) &&
        profile.city
      ) {
        setValue(input, profile.city);
        continue;
      }

      // State
      if (
        fieldMatches(input, ["state", "province", "region"]) &&
        profile.state
      ) {
        setValue(input, profile.state);
        continue;
      }

      // Zip / Postal
      if (
        fieldMatches(input, ["zip", "postal", "postcode", "postal code"]) &&
        profile.zip
      ) {
        setValue(input, profile.zip);
        continue;
      }

      // Country
      if (fieldMatches(input, ["country"]) && profile.country) {
        setValue(input, profile.country);
        return;
      }

      // Address
      if (
        fieldMatches(input, ["address", "street", "street address"]) &&
        profile.address
      ) {
        setValue(input, profile.address);
        continue;
      }

      // LinkedIn
      if (
        fieldMatches(input, ["linkedin", "linked in"]) &&
        profile.linkedin
      ) {
        setValue(input, profile.linkedin);
        continue;
      }

      // GitHub
      if (fieldMatches(input, ["github", "git hub"]) && profile.github) {
        setValue(input, profile.github);
        continue;
      }

      // Portfolio / Website
      if (
        fieldMatches(input, ["portfolio", "website", "site", "url"]) &&
        profile.portfolio
      ) {
        setValue(input, profile.portfolio);
        continue;
      }

      // Current Title
      if (fieldMatches(input, ["title", "role"]) && profile.title) {
        setValue(input, profile.title);
        continue;
      }

      // Current Company
      if (
        fieldMatches(input, ["company", "employer", "organization"]) &&
        profile.company
      ) {
        setValue(input, profile.company);
        continue;
      }

      // Role Description / Summary
      if (
        fieldMatches(input, ["description", "responsibilities", "summary", "role description"]) &&
        (profile.title || profile.company)
      ) {
        setValue(input, `${profile.title || ""} ${profile.company ? `at ${profile.company}` : ""}`.trim());
        continue;
      }

      // From / Start date (MM/YYYY)
      if (
        fieldMatches(input, ["from", "start date", "start", "mm/yyyy"]) &&
        setTextDateIfNeeded(input, defaultAnswers.fromDate)
      ) {
        continue;
      }

      // To / End date (MM/YYYY)
      if (
        fieldMatches(input, ["to", "end date", "end", "mm/yyyy"]) &&
        setTextDateIfNeeded(input, defaultAnswers.toDate)
      ) {
        continue;
      }

      // Degree / Major on custom dropdowns
      if (fieldMatches(input, ["degree"])) {
        if (tryCustomDropdown(["degree"], degreeVariants(defaultAnswers.degree), true)) continue;
      }
      if (fieldMatches(input, ["field of study", "major", "program"])) {
        if (tryCustomDropdown(["field of study", "major", "program"], [defaultAnswers.major], true)) continue;
      }

      // Source / Hear About (Text Input equivalent)
      if (fieldMatches(input, ["how did you hear", "source"])) {
        if (profile.question_hear_about) {
          setValue(input, profile.question_hear_about);
          continue;
        }
      }

      // Preferred Office Location
      if (
        fieldMatches(input, ["office location", "preferred location", "preferred office"]) &&
        profile.question_office_location
      ) {
        setValue(input, profile.question_office_location);
        continue;
      }

      // Conflict of Interest Details
      if (
        (input.tagName === "TEXTAREA" || input.type === "text") &&
        fieldMatches(input, ["conflict", "relationship", "outside business", "investment"]) &&
        profile.question_conflict_details
      ) {
        setValue(input, profile.question_conflict_details);
        continue;
      }

      // Government Official Details
      if (
        (input.tagName === "TEXTAREA" || input.type === "text") &&
        fieldMatches(input, ["government", "official", "corruption"]) &&
        profile.question_gov_details
      ) {
        setValue(input, profile.question_gov_details);
        continue;
      }

      // Password
      if (
        (input.type === "password" ||
          fieldMatches(input, ["password", "passcode"])) &&
        defaultAnswers.password
      ) {
        // Show password as text so user can see it
        input.type = "text";
        setValue(input, defaultAnswers.password);
        continue;
      }
    }
  }

  // Message Listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FILL_FORM") {
      const profile = message.profile || {};
      if (message.resume) {
        profile.resume = message.resume;
      }
      fillForm(profile);
      sendResponse({ success: true });
    }
  });

})();
