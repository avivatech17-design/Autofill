const puppeteer = require('puppeteer');

const ACCOUNTS = [
    { email: 'vijayputta45@gmail.com', password: 'Wsxedc123@', label: 'NEW ACCOUNT' }
];

(async () => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 800 }
    });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    const clickButtonByText = async (text) => {
        await page.evaluate((btnText) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.innerText.includes(btnText) && !b.disabled && b.offsetParent !== null);
            if (btn) btn.click();
            else throw new Error(`Button with text "${btnText}" not found`);
        }, text);
    };

    const login = async (email, password) => {
        console.log(`Logging in as ${email}...`);
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

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

    try {
        for (const account of ACCOUNTS) {
            console.log(`\n--- TESTING ${account.label} ---`);
            await login(account.email, account.password);

            // Go to Profile Tab
            await clickButtonByText('Profile');
            await page.waitForSelector('input[placeholder="e.g. John Doe"]');

            // 1. Test Full Name
            console.log('Testing Full Name...');
            const uniqueName = `User ${Date.now()}`;
            // Clear existing
            await page.click('input[placeholder="e.g. John Doe"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[placeholder="e.g. John Doe"]', uniqueName);

            await clickButtonByText('Save Changes');
            await page.waitForFunction(() => document.body.innerText.includes('Saved personal info'), { timeout: 5000 });
            console.log('Saved Full Name.');

            // Reload and Verify
            await page.reload({ waitUntil: 'networkidle0' });
            await clickButtonByText('Profile');
            await page.waitForSelector('input[placeholder="e.g. John Doe"]');

            const nameVal = await page.$eval('input[placeholder="e.g. John Doe"]', el => el.value);
            if (nameVal !== uniqueName) throw new Error(`Full Name failed. Expected ${uniqueName}, got ${nameVal}`);
            console.log('Full Name Verified.');

            // 2. Test Phone
            console.log('Testing Phone...');
            const uniquePhone = `+1 555 ${Math.floor(Math.random() * 10000)}`;
            await page.click('input[placeholder="e.g. +1 555 0123"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[placeholder="e.g. +1 555 0123"]', uniquePhone);
            await clickButtonByText('Save Changes');
            await page.waitForFunction(() => document.body.innerText.includes('Saved personal info'), { timeout: 5000 });
            console.log('Saved Phone.');

            // 3. Test Links
            console.log('Testing Links...');
            const uniqueLinkedin = `https://linkedin.com/in/user${Date.now()}`;
            const uniqueGithub = `https://github.com/user${Date.now()}`;
            const uniquePortfolio = `https://portfolio${Date.now()}.com`;

            await page.click('input[placeholder="https://linkedin.com/in/..."]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[placeholder="https://linkedin.com/in/..."]', uniqueLinkedin);

            await page.click('input[placeholder="https://github.com/..."]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[placeholder="https://github.com/..."]', uniqueGithub);

            await page.click('input[placeholder="https://..."]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[placeholder="https://..."]', uniquePortfolio);

            await clickButtonByText('Save Changes');
            await page.waitForFunction(() => document.body.innerText.includes('Saved personal info'), { timeout: 5000 });
            console.log('Saved Links.');

            // Reload and Verify All
            await page.reload({ waitUntil: 'networkidle0' });
            await clickButtonByText('Profile');
            await page.waitForSelector('input[placeholder="e.g. John Doe"]');

            const nameValFinal = await page.$eval('input[placeholder="e.g. John Doe"]', el => el.value);
            if (nameValFinal !== uniqueName) throw new Error(`Full Name failed. Expected ${uniqueName}, got ${nameValFinal}`);
            console.log('Full Name Verified.');

            const phoneVal = await page.$eval('input[placeholder="e.g. +1 555 0123"]', el => el.value);
            if (phoneVal !== uniquePhone) throw new Error(`Phone failed. Expected ${uniquePhone}, got ${phoneVal}`);
            console.log('Phone Verified.');

            const linkedinVal = await page.$eval('input[placeholder="https://linkedin.com/in/..."]', el => el.value);
            if (linkedinVal !== uniqueLinkedin) throw new Error(`LinkedIn failed. Expected ${uniqueLinkedin}, got ${linkedinVal}`);
            console.log('LinkedIn Verified.');

            const githubVal = await page.$eval('input[placeholder="https://github.com/..."]', el => el.value);
            if (githubVal !== uniqueGithub) throw new Error(`GitHub failed. Expected ${uniqueGithub}, got ${githubVal}`);
            console.log('GitHub Verified.');

            const portfolioVal = await page.$eval('input[placeholder="https://..."]', el => el.value);
            if (portfolioVal !== uniquePortfolio) throw new Error(`Portfolio failed. Expected ${uniquePortfolio}, got ${portfolioVal}`);
            console.log('Portfolio Verified.');

            // 2. Test Email (Profile Email, separate from Auth Email)
            // Note: The UI might not have an editable email field if it's tied to auth, checking page.js...
            // page.js has: <input value={profile.email || ''} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="john@example.com" />

            /* 
            console.log('Testing Profile Email...');
            const uniqueEmail = `test${Date.now()}@example.com`;
            await page.click('input[placeholder="john@example.com"]', { clickCount: 3 });
            await page.keyboard.press('Backspace');
            await page.type('input[placeholder="john@example.com"]', uniqueEmail);
            await clickButtonByText('Save Changes');
            await page.waitForFunction(() => document.body.innerText.includes('Saved personal info'), { timeout: 5000 });
            
            await page.reload({ waitUntil: 'networkidle0' });
            await clickButtonByText('Profile');
            await page.waitForSelector('input[placeholder="john@example.com"]');
            const emailVal = await page.$eval('input[placeholder="john@example.com"]', el => el.value);
            if (emailVal !== uniqueEmail) throw new Error(`Email failed. Expected ${uniqueEmail}, got ${emailVal}`);
            console.log('Profile Email Verified.');
            */

            console.log(`--- ${account.label} PASSED ---\n`);
        }
    } catch (e) {
        console.error('\nTEST FAILED:', e);
    } finally {
        await browser.close();
    }
})();
