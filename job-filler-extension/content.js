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
    const labelText = (
      input.closest("label")?.innerText ||
      input.parentElement?.querySelector("label")?.innerText ||
      Array.from(input.labels || [])
        .map((l) => l.innerText)
        .join(" ") ||
      ""
    ).toLowerCase();

    return keywords.some((kw) => {
      if (!kw) return false;
      kw = kw.toLowerCase();
      return (
        name.includes(kw) ||
        id.includes(kw) ||
        placeholder.includes(kw) ||
        ariaLabel.includes(kw) ||
        dataLabel.includes(kw) ||
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

  function tryCustomDropdown(keywords, variants, allowFallback = false) {
    const dropdowns = Array.from(
      document.querySelectorAll("[role='combobox'], [aria-haspopup='listbox'], [data-testid*='select'], .select, .Select, [data-selectable]")
    ).filter(visible);

    const matchesKw = (el) => fieldMatches(el, keywords);

    for (const dd of dropdowns) {
      if (!matchesKw(dd)) continue;
      try {
        dd.click();
      } catch (_) { }
      // small delay-free search of options currently in DOM
      const options = Array.from(
        document.querySelectorAll("[role='option'], li, [data-testid*='option'], .option, .Select-option")
      );
      const isPlaceholder = (text) => {
        const t = (text || "").toLowerCase();
        return (
          !t ||
          t.includes("select") ||
          t.includes("choose") ||
          t.includes("none") ||
          t.includes("option") ||
          t.includes("----")
        );
      };

      for (const opt of options) {
        const text = (opt.innerText || opt.textContent || "").trim().toLowerCase();
        if (!text) continue;
        for (const v of variants) {
          const norm = (v || "").toString().toLowerCase();
          if (norm && (text === norm || text.includes(norm))) {
            try {
              opt.click();
              return true;
            } catch (_) {
              continue;
            }
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
            fallback.click();
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
      // Bottom-up approach: Find buttons first
      const buttons = Array.from(document.querySelectorAll("button, a[role='button'], div[role='button'], input[type='button']"))
        .filter(visible);

      const addButtons = buttons.filter(btn => {
        const txt = (btn.innerText || btn.value || "").toLowerCase();
        const testId = (btn.getAttribute("data-automation-id") || "").toLowerCase();
        // Match "Add", "Add Another", "Add Work Experience", etc.
        return (txt.includes("add") || testId.includes("add")) && !txt.includes("save") && !txt.includes("submit");
      });

      for (const btn of addButtons) {
        // Find the closest header or section label for this button
        // We look up the tree, and for each parent, we look for a header *within* that parent (or the parent itself)
        let parent = btn.parentElement;
        let foundHeader = null;

        // Traverse up to find a container that has a relevant header
        while (parent && parent !== document.body) {
          // Check if parent is aria-labelledby
          const labelledBy = parent.getAttribute("aria-labelledby");
          if (labelledBy) {
            const header = document.getElementById(labelledBy);
            if (header && keywords.some(kw => (header.innerText || "").toLowerCase().includes(kw))) {
              foundHeader = header;
              break;
            }
          }

          // Check for headers inside this parent
          const headers = Array.from(parent.querySelectorAll("h1, h2, h3, h4, h5, h6, label, legend"))
            .filter(el => visible(el) && keywords.some(kw => (el.innerText || "").toLowerCase().includes(kw)));

          if (headers.length > 0) {
            // Found a header in this container. 
            // We assume this container is the section.
            foundHeader = headers[0];
            break;
          }

          parent = parent.parentElement;
          if (!parent) break;
        }

        if (foundHeader) {
          // We found a button belonging to the correct section.
          // Now check counts.
          // We search for inputs within the *same container* where we found the header (which is `parent`)
          const container = parent;
          const inputs = Array.from(container.querySelectorAll("input:not([type='hidden']), select, textarea")).filter(visible);

          let visibleCount = 0;
          if (itemType === 'work') {
            const companies = inputs.filter(i => fieldMatches(i, ["company", "employer", "organization"]));
            const titles = inputs.filter(i => fieldMatches(i, ["title", "role", "position"]));
            visibleCount = Math.max(companies.length, titles.length);
          } else if (itemType === 'education') {
            const schools = inputs.filter(i => fieldMatches(i, ["school", "university", "college", "institution"]));
            const degrees = inputs.filter(i => fieldMatches(i, ["degree", "qualification"]));
            visibleCount = Math.max(schools.length, degrees.length);
          }

          const needed = itemType === 'work' ? experiences.length : educations.length;

          if (visibleCount < needed && needed > 0) {
            btn.click();
            return true;
          }
        }
      }
      return false;
    };

    let clicked = false;
    if (clickAddForSection(["work experience", "employment history"], 'work')) clicked = true;
    if (!clicked && clickAddForSection(["education", "academic history"], 'education')) clicked = true;

    return clicked;
  }

  function fillForm(profile) {
    // Check if we need to expand sections first
    // We pass 'true' to indicate we are in the initial expansion phase
    if (checkAndClickAddButtons(profile)) {
      // If we clicked a button, wait a bit and retry filling
      // We need to wait long enough for the form to appear
      setTimeout(() => fillForm(profile), 1000);
      return;
    }

    const safeProfile = profile || {};
    const exp0 = (safeProfile.experiences && safeProfile.experiences[0]) || {};
    const edu0 = (safeProfile.educations && safeProfile.educations[0]) || {};

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

    inputs.forEach((input) => {
      // Previous Employment / Current Employee Questions -> Default NO
      if (input.type === 'radio' || input.tagName === 'SELECT') {
        const question = (
          input.closest("fieldset")?.querySelector("legend")?.innerText ||
          input.closest("div[role='group']")?.querySelector("h3, h4, label")?.innerText ||
          input.closest("div")?.innerText ||
          ""
        ).toLowerCase();

        const keywords = ["previously worked", "worked for", "current employee", "currently work for", "employment history at"];
        if (keywords.some(kw => question.includes(kw))) {
          // It's a relevant question. Try to select "No".
          if (input.tagName === 'SELECT') {
            // Try to find "No" option
            for (const opt of input.options) {
              const txt = (opt.text || "").toLowerCase();
              if (txt === "no" || txt === "false") {
                input.value = opt.value;
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return;
              }
            }
          } else if (input.type === 'radio') {
            const label = (input.nextElementSibling?.innerText || input.parentElement?.innerText || "").toLowerCase();
            const val = (input.value || "").toLowerCase();
            if (label.includes("no") || val === "no" || val === "false" || val === "0") {
              input.click();
              return;
            }
          }
        }
      }

      if (input.tagName === "SELECT") {
        // Handle dropdowns
        const select = input;

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
              select.value = opt.value;
              select.dispatchEvent(new Event("input", { bubbles: true }));
              select.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            }
          }
          // fallback partial match
          for (const opt of Array.from(select.options)) {
            const text = (opt.textContent || "").trim();
            const normText = normalize(text);
            if (normText.includes(normTarget)) {
              select.value = opt.value;
              select.dispatchEvent(new Event("input", { bubbles: true }));
              select.dispatchEvent(new Event("change", { bubbles: true }));
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
          "newhampshire": "nh",
          "newjersey": "nj",
          "newmexico": "nm",
          "newyork": "ny",
          "northcarolina": "nc",
          "northdakota": "nd",
          ohio: "oh",
          oklahoma: "ok",
          oregon: "or",
          pennsylvania: "pa",
          "rhodeisland": "ri",
          "southcarolina": "sc",
          "southdakota": "sd",
          tennessee: "tn",
          texas: "tx",
          utah: "ut",
          vermont: "vt",
          virginia: "va",
          washington: "wa",
          "westvirginia": "wv",
          wisconsin: "wi",
          wyoming: "wy",
          "districtofcolumbia": "dc",
        };

        const stateVariants = (val) => {
          const norm = normalize(val);
          const variants = [];
          if (norm.length <= 3) {
            // abbreviation provided; look for full
            const full = Object.keys(stateMap).find(
              (name) => stateMap[name] === norm
            );
            if (full) variants.push(full);
          } else {
            const abbr = stateMap[norm];
            if (abbr) variants.push(abbr);
          }
          return variants;
        };

        // State
        if (
          fieldMatches(select, ["state", "province", "region"]) &&
          profile.state
        ) {
          if (trySelectVariants(profile.state, stateVariants(profile.state)))
            return;

          // Improved State Matching for Dropdowns
          // Try to match by full text, fuzzy match, or abbreviation
          const targetState = normalize(profile.state);
          for (const opt of Array.from(select.options)) {
            const text = normalize(opt.textContent || "");
            const val = normalize(opt.value || "");

            // Exact match
            if (text === targetState || val === targetState) {
              select.value = opt.value;
              select.dispatchEvent(new Event("change", { bubbles: true }));
              return;
            }

            // Check if option contains target (e.g. "California (CA)" contains "california")
            if (text.includes(targetState)) {
              select.value = opt.value;
              select.dispatchEvent(new Event("change", { bubbles: true }));
              return;
            }
          }
        }

        // Heuristic: select likely containing US states
        if (profile.state) {
          const optionsText = Array.from(select.options).map((o) =>
            normalize(o.textContent || o.value || "")
          );
          const stateHits = optionsText.filter((t) => stateMap[t]).length;
          if (optionsText.length >= 20 && stateHits >= 5) {
            if (trySelectVariants(profile.state, stateVariants(profile.state)))
              return;
          }
        }

        // Country
        if (fieldMatches(select, ["country"]) && profile.country) {
          if (trySelect(profile.country)) return;
        }

        // City
        if (fieldMatches(select, ["city", "location"]) && profile.city) {
          if (trySelect(profile.city)) return;
        }

        // Start Month / From Month
        if (
          fieldMatches(select, ["start month", "from month", "from", "start"]) &&
          defaultAnswers.startMonth
        ) {
          if (trySelectVariants(defaultAnswers.startMonth, monthVariants(defaultAnswers.startMonth)))
            return;
        }

        // End Month / To Month
        if (
          fieldMatches(select, ["end month", "to month", "to", "end"])
        ) {
          // If currently working here, try to select empty or "Present" if available, or just skip
          if (profile.is_current || safeProfile.is_current) {
            if (trySelectVariants("", ["", "present", "current"])) return;
          } else if (defaultAnswers.endMonth) {
            if (trySelectVariants(defaultAnswers.endMonth, monthVariants(defaultAnswers.endMonth)))
              return;
          }
        }

        // Start Year
        if (
          fieldMatches(select, ["start year", "from year", "start"]) &&
          defaultAnswers.startYear
        ) {
          if (trySelect(String(defaultAnswers.startYear))) return;
        }

        // End Year
        if (
          fieldMatches(select, ["end year", "to year", "end"])
        ) {
          if (profile.is_current || safeProfile.is_current) {
            if (trySelectVariants("", ["", "present", "current"])) return;
          } else if (defaultAnswers.endYear) {
            if (trySelect(String(defaultAnswers.endYear))) return;
          }
        }

        // Degree / Field of study
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
          if (trySelect(defaultAnswers.source)) return;
        }

        return;
      }

      // Skills Input - Loop through skills
      if (fieldMatches(input, ["skills", "skill", "technologies", "keywords"])) {
        if (safeProfile.skills && Array.isArray(safeProfile.skills) && safeProfile.skills.length > 0) {
          // Only try to fill if empty or looks like a search box
          if (!input.value) {
            // We can't easily loop here because it requires interaction (type, enter, type, enter).
            // Best we can do is try to fill one by one or comma separated depending on the field.
            // Heuristic: if it looks like a tag input (often has no value but has a container), we might need a more complex approach.
            // For now, let's try to fill the first few skills comma-separated, or just the top skills.
            // User request: "read from our skills and manually enter one by one"
            // This usually requires a separate async process.
            // Let's attach a special handler for skills.
            fillSkillsOneByOne(input, safeProfile.skills);
            return;
          }
        }
      }

      if (input.type === "checkbox") {
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
          return;
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

        if (hasExisting) return; // Skip if already uploaded

        if (profile.resume) {
          const file = dataUrlToFile(profile.resume);
          if (file) setFileInput(input, file);
        }
        return;
      }

      if (existing && !looksLikePlaceholder && !isPasswordField && !isDateField) return;
      if (input.type === "hidden") return;

      // Full name
      if (
        fieldMatches(input, ["full name", "name", "candidate name"]) &&
        profile.fullName
      ) {
        setValue(input, profile.fullName);
        return;
      }

      // First name
      if (
        fieldMatches(input, ["first name", "given name", "fname", "first"]) &&
        profile.firstName
      ) {
        setValue(input, profile.firstName);
        return;
      }

      // Last name
      if (
        fieldMatches(input, ["last name", "surname", "family name", "lname"]) &&
        profile.lastName
      ) {
        setValue(input, profile.lastName);
        return;
      }

      // Email
      if (
        fieldMatches(input, ["email", "e-mail"]) &&
        profile.email &&
        input.type !== "password"
      ) {
        setValue(input, profile.email);
        return;
      }

      // Phone
      if (fieldMatches(input, ["phone", "mobile", "contact"]) && profile.phone) {
        setValue(input, profile.phone);
        return;
      }

      // City / Location
      if (
        fieldMatches(input, ["city", "location", "current city"]) &&
        profile.city
      ) {
        setValue(input, profile.city);
        return;
      }

      // State
      if (
        fieldMatches(input, ["state", "province", "region"]) &&
        profile.state
      ) {
        setValue(input, profile.state);
        return;
      }

      // Zip / Postal
      if (
        fieldMatches(input, ["zip", "postal", "postcode", "postal code"]) &&
        profile.zip
      ) {
        setValue(input, profile.zip);
        return;
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
        return;
      }

      // LinkedIn
      if (
        fieldMatches(input, ["linkedin", "linked in"]) &&
        profile.linkedin
      ) {
        setValue(input, profile.linkedin);
        return;
      }

      // GitHub
      if (fieldMatches(input, ["github", "git hub"]) && profile.github) {
        setValue(input, profile.github);
        return;
      }

      // Portfolio / Website
      if (
        fieldMatches(input, ["portfolio", "website", "site", "url"]) &&
        profile.portfolio
      ) {
        setValue(input, profile.portfolio);
        return;
      }

      // Current Title
      if (fieldMatches(input, ["title", "role"]) && profile.title) {
        setValue(input, profile.title);
        return;
      }

      // Current Company
      if (
        fieldMatches(input, ["company", "employer", "organization"]) &&
        profile.company
      ) {
        setValue(input, profile.company);
        return;
      }

      // Role Description / Summary
      if (
        fieldMatches(input, ["description", "responsibilities", "summary", "role description"]) &&
        (profile.title || profile.company)
      ) {
        setValue(input, `${profile.title || ""} ${profile.company ? `at ${profile.company}` : ""}`.trim());
        return;
      }

      // From / Start date (MM/YYYY)
      if (
        fieldMatches(input, ["from", "start date", "start", "mm/yyyy"]) &&
        setTextDateIfNeeded(input, defaultAnswers.fromDate)
      ) {
        return;
      }

      // To / End date (MM/YYYY)
      if (
        fieldMatches(input, ["to", "end date", "end", "mm/yyyy"]) &&
        setTextDateIfNeeded(input, defaultAnswers.toDate)
      ) {
        return;
      }

      // Degree / Major on custom dropdowns
      if (fieldMatches(input, ["degree"])) {
        if (tryCustomDropdown(["degree"], degreeVariants(defaultAnswers.degree), true)) return;
      }
      if (fieldMatches(input, ["field of study", "major", "program"])) {
        if (tryCustomDropdown(["field of study", "major", "program"], [defaultAnswers.major], true)) return;
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
        return;
      }
    });
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
