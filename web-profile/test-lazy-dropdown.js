const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const filePath = `file://${path.join(__dirname, 'mock-lazy-dropdown.html')}`;

    console.log('Navigating to:', filePath);
    await page.goto(filePath);

    // TEST 1: Current Logic (Immediate Select)
    console.log('\n--- TEST 1: Immediate Select (Current Logic) ---');
    const result1 = await page.evaluate(async () => {
        const select = document.getElementById('country');

        // Helper
        function normalize(text) { return (text || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

        function trySelect(val) {
            const normTarget = normalize(val);
            for (const opt of Array.from(select.options)) {
                const text = (opt.textContent || "").trim();
                const normText = normalize(text);
                if (normText === normTarget) {
                    select.value = opt.value;
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                    return true;
                }
            }
            return false;
        }

        // Try to select United States immediately
        if (trySelect("United States")) return { success: true, val: select.value };

        return { success: false, val: select.value };
    });
    console.log('Result 1:', result1); // Should FAIL

    // Reload for fresh state
    await page.goto(filePath);

    // TEST 2: New Logic (Click & Wait)
    console.log('\n--- TEST 2: Click & Wait (Proposed Fix) ---');
    const result2 = await page.evaluate(async () => {
        const select = document.getElementById('country');

        function normalize(text) { return (text || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
        function trySelect(val) {
            const normTarget = normalize(val);
            for (const opt of Array.from(select.options)) {
                const text = (opt.textContent || "").trim();
                const normText = normalize(text);
                if (normText === normTarget) {
                    select.value = opt.value;
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                    return true;
                }
            }
            return false;
        }

        // Logic: Click, Wait, Retry
        console.log('Clicking dropdown...');
        select.click();
        select.focus();

        console.log('Waiting for options...');
        await new Promise(r => setTimeout(r, 600)); // Wait > 300ms load time

        console.log('Retrying select...');
        if (trySelect("United States")) return { success: true, val: select.value };

        return { success: false, val: select.value };
    });
    console.log('Result 2:', result2); // Should SUCCESS

    await browser.close();
})();
