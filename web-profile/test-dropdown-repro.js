const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const filePath = `file://${path.join(__dirname, 'mock-dropdown.html')}`;

    console.log('Navigating to:', filePath);
    await page.goto(filePath);

    // Inject the autofill logic we want to test
    const result = await page.evaluate(async () => {
        // --- CONTENT.JS HELPERS ---
        function normalize(text) {
            return (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
        }

        // --- TEST LOGIC ---
        const select = document.getElementById('country');

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
                    console.log(`Matched: ${text} (${value}) for input: ${val}`);
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

        // --- SCENARIO 1: Profile has "United States" ---
        const profileCountry = "United States";
        console.log('Testing Profile Country:', profileCountry);

        // Logic from content.js Country block
        let caught = false;
        if (trySelect(profileCountry)) {
            caught = true;
        } else {
            // Explicit US variants check (as added in fix)
            const norm = normalize(profileCountry);
            if (["unitedstates", "usa", "us", "america", "unitedstatesofamerica"].includes(norm)) {
                if (trySelect("United States")) caught = true;
                else if (trySelect("USA")) caught = true;
                else if (trySelect("US")) caught = true;
            }
        }

        return {
            caught,
            selectedValue: select.value,
            selectedText: select.options[select.selectedIndex].text
        };
    });

    console.log('Test Result:', result);

    if (result.caught && result.selectedText.includes('United States')) {
        console.log('SUCCESS: Correctly matched and selected United States');
    } else {
        console.error('FAILURE: Did not select United States');
        process.exit(1);
    }

    await browser.close();
})();
