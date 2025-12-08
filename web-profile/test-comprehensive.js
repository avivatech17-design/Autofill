const puppeteer = require('puppeteer');

const ACCOUNTS = [
    { email: 'vijayputta45@gmail.com', password: 'Wsxedc123@', label: 'NEW ACCOUNT' },
    { email: 'vijayputta41@gmail.com', password: 'Wsxedc123@', label: 'OLD ACCOUNT' }
];

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Helper: Click button by text
    const clickButtonByText = async (text) => {
        await page.evaluate((btnText) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.innerText.includes(btnText) && !b.disabled && b.offsetParent !== null);
            if (btn) btn.click();
            else throw new Error(`Button with text "${btnText}" not found`);
        }, text);
    };

    // Helper: Login
    const login = async (email, password) => {
        console.log(`Logging in as ${email}...`);
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

        // Check if already logged in
        const isLoggedIn = await page.evaluate(() => document.body.innerText.includes('Sign Out'));
        if (isLoggedIn) {
            console.log('Already logged in, signing out first...');
            await clickButtonByText('Sign Out');
            await page.waitForFunction(() => document.body.innerText.includes('Sign In'));
        }

        await page.waitForSelector('input[placeholder="name@example.com"]');
        await page.type('input[placeholder="name@example.com"]', email);
        await page.type('input[placeholder="••••••••"]', password);
        await clickButtonByText('Sign In');

        await page.waitForFunction(() => document.body.innerText.includes('Sign Out'), { timeout: 10000 });
        console.log('Login successful.');
    };

    // Helper: Add Work Experience
    const addWorkExperience = async (companyName) => {
        console.log(`Adding work experience: ${companyName}...`);
        await clickButtonByText('Work');

        // Wait for + Add button
        await page.waitForFunction(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.some(b => b.innerText.includes('+ Add'));
        });
        await clickButtonByText('+ Add');

        // Wait for new item to appear
        await page.waitForSelector('.work-item');

        // Find the LAST work item (the new one)
        const workItems = await page.$$('.work-item');
        const lastItem = workItems[workItems.length - 1];

        // Find inputs within the last item
        const inputs = await lastItem.$$('input');
        if (inputs.length > 0) {
            // Focus and type company name
            await inputs[0].focus();
            // Clear existing value if any (though it should be empty for new add)
            await page.keyboard.down('Control');
            await page.keyboard.press('A');
            await page.keyboard.up('Control');
            await page.keyboard.press('Backspace');

            await page.keyboard.type(companyName, { delay: 100 });
            // Small delay to ensure state update
            await new Promise(r => setTimeout(r, 1000));
        } else {
            throw new Error('No inputs found in work item');
        }
    };

    // Helper: Save
    const saveWork = async () => {
        console.log('Saving work...');
        await clickButtonByText('Save');
        await page.waitForFunction(() => document.body.innerText.includes('Saved work'), { timeout: 5000 });
        console.log('Save confirmed.');
    };

    // Helper: Verify Persistence
    const verifyPersistence = async (companyName) => {
        console.log('Reloading to verify persistence...');
        await page.reload({ waitUntil: 'networkidle0' });
        await clickButtonByText('Work');
        await page.waitForSelector('.work-item');

        const content = await page.evaluate(() => {
            const inputs = document.querySelectorAll('.work-item input');
            return Array.from(inputs).map(i => i.value);
        });

        if (content.some(v => v.includes(companyName))) {
            console.log(`SUCCESS: Found "${companyName}" in saved data.`);
            return true;
        } else {
            console.error(`FAILURE: "${companyName}" NOT found. Found: ${content.join(', ')}`);
            return false;
        }
    };

    try {
        for (const account of ACCOUNTS) {
            console.log(`\n--- TESTING ${account.label} ---`);
            await login(account.email, account.password);

            const uniqueCompany = `Test Corp ${Date.now()}`;
            await addWorkExperience(uniqueCompany);
            await saveWork();

            // Test Profile Saving
            console.log('Testing Profile Saving...');
            await clickButtonByText('Profile');
            await page.waitForSelector('input[placeholder="e.g. John Doe"]');
            const uniqueName = `Test User ${Date.now()}`;
            await page.type('input[placeholder="e.g. John Doe"]', uniqueName);
            await clickButtonByText('Save Changes');
            await page.waitForFunction(() => document.body.innerText.includes('Saved personal info'), { timeout: 5000 });
            console.log('Profile saved.');

            const success = await verifyPersistence(uniqueCompany);
            if (!success) throw new Error(`Work Persistence failed for ${account.email}`);

            // Verify Profile Persistence
            console.log('Verifying Profile Persistence...');
            await clickButtonByText('Profile');
            await page.waitForSelector('input[placeholder="e.g. John Doe"]');
            const nameValue = await page.$eval('input[placeholder="e.g. John Doe"]', el => el.value);
            if (nameValue !== uniqueName) {
                throw new Error(`Profile Persistence failed for ${account.email}. Expected "${uniqueName}", found "${nameValue}"`);
            }
            console.log(`SUCCESS: Found "${uniqueName}" in profile.`);

            console.log(`--- ${account.label} PASSED ---\n`);
        }
        console.log('\nALL TESTS PASSED SUCCESSFULLY.');
    } catch (e) {
        console.error('\nTEST FAILED:', e);
    } finally {
        await browser.close();
    }
})();
