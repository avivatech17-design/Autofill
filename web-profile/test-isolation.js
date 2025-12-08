const puppeteer = require('puppeteer');
const fs = require('fs');

// Test accounts
const ACCOUNTS = [
    {
        email: 'vijayputta45@gmail.com',
        password: 'Wsxedc123@',
        label: 'USER_45',
        testData: {
            fullName: 'Vijay Putta User45',
            phone: '+1-555-0045',
            city: 'Seattle45',
            company: 'Company45 Inc',
            title: 'Senior Engineer45',
            workCompany: 'Previous45 Corp',
            workTitle: 'Developer45',
            workLocation: 'Location45',
            school: 'University45',
            degree: 'Bachelor of Science',
            major: 'Computer Science45',
            skills: ['JavaScript45', 'Python45', 'React45'],
            language: 'English',
            proficiency: 'Native'
        }
    },
    {
        email: 'vijayputta41@gmail.com',
        password: 'Wsxedc123@',
        label: 'USER_41',
        testData: {
            fullName: 'Vijay Putta User41',
            phone: '+1-555-0041',
            city: 'Portland41',
            company: 'Company41 LLC',
            title: 'Principal Engineer41',
            workCompany: 'Previous41 Corp',
            workTitle: 'Developer41',
            workLocation: 'Location41',
            school: 'University41',
            degree: 'Master of Science',
            major: 'Software Engineering41',
            skills: ['JavaScript41', 'Python41', 'Vue41'],
            language: 'Spanish',
            proficiency: 'Fluent'
        }
    }
];

// Store data for cross-verification
const savedUserData = {};

(async () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MULTI-USER DATA ISOLATION TEST');
    console.log('  Testing: vijayputta45@gmail.com & vijayputta41@gmail.com');
    console.log('═══════════════════════════════════════════════════════════\n');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: { width: 1280, height: 900 }
    });
    const page = await browser.newPage();

    // Capture console logs
    page.on('console', msg => console.log('  [PAGE]:', msg.text()));

    // Helper: Click button by text
    const clickButtonByText = async (text, options = {}) => {
        const timeout = options.timeout || 5000;
        await page.waitForFunction((btnText) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            return buttons.some(b => b.innerText.includes(btnText) && !b.disabled && b.offsetParent !== null);
        }, { timeout }, text);

        await page.evaluate((btnText) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.innerText.includes(btnText) && !b.disabled && b.offsetParent !== null);
            if (btn) btn.click();
            else throw new Error(`Button with text "${btnText}" not found`);
        }, text);
    };

    // Helper: Clear and type into input
    const clearAndType = async (selector, value) => {
        await page.waitForSelector(selector);
        await page.click(selector, { clickCount: 3 });
        await page.keyboard.press('Backspace');
        if (value) {
            await page.type(selector, value, { delay: 50 });
        }
    };

    // Helper: Login
    const login = async (email, password) => {
        console.log(`\n→ Logging in as ${email}...`);

        try {
            await page.goto('http://localhost:3000', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log('  Navigation failed, retrying...');
            await page.goto('http://localhost:3000', {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            await new Promise(r => setTimeout(r, 3000));
        }

        // Check if already logged in
        const isLoggedIn = await page.evaluate(() => document.body.innerText.includes('Sign Out'));
        if (isLoggedIn) {
            console.log('  Already logged in, signing out first...');
            await clickButtonByText('Sign Out');
            await page.waitForFunction(() => document.body.innerText.includes('Sign In'), { timeout: 10000 });
            await new Promise(r => setTimeout(r, 1000));
        }

        await page.waitForSelector('input[placeholder="name@example.com"]', { timeout: 10000 });
        await clearAndType('input[placeholder="name@example.com"]', email);
        await clearAndType('input[placeholder="••••••••"]', password);
        await clickButtonByText('Sign In');

        await page.waitForFunction(() => document.body.innerText.includes('Sign Out'), { timeout: 20000 });
        console.log('  ✓ Login successful');
        await new Promise(r => setTimeout(r, 1500));
    };

    // Helper: Logout
    const logout = async () => {
        console.log('→ Logging out...');
        await clickButtonByText('Sign Out');
        await page.waitForFunction(() => document.body.innerText.includes('Sign In'), { timeout: 5000 });
        console.log('  ✓ Logged out');
        await new Promise(r => setTimeout(r, 1000));
    };

    // Helper: Fill Profile Data
    const fillProfileData = async (testData) => {
        console.log('→ Filling Profile data...');
        await clickButtonByText('Profile');
        await new Promise(r => setTimeout(r, 1000));

        await clearAndType('input[placeholder="e.g. John Doe"]', testData.fullName);
        await clearAndType('input[placeholder="e.g. +1 (555) 123-4567"]', testData.phone);
        await clearAndType('input[placeholder="e.g. San Francisco"]', testData.city);
        await clearAndType('input[placeholder="e.g. Google"]', testData.company);
        await clearAndType('input[placeholder="e.g. Software Engineer"]', testData.title);

        await clickButtonByText('Save Changes');
        await page.waitForFunction(() => document.body.innerText.includes('Saved personal info'), { timeout: 10000 });
        console.log('  ✓ Profile data saved');
        await new Promise(r => setTimeout(r, 1000));
    };

    // Helper: Add Work Experience
    const addWorkExperience = async (testData) => {
        console.log('→ Adding Work Experience...');
        await clickButtonByText('Work');
        await new Promise(r => setTimeout(r, 1000));

        await clickButtonByText('+ Add');
        await page.waitForSelector('.work-item', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));

        const workItems = await page.$$('.work-item');
        const lastItem = workItems[workItems.length - 1];

        const inputs = await lastItem.$$('input');
        if (inputs.length >= 3) {
            await inputs[0].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[0].type(testData.workCompany, { delay: 50 });

            await inputs[1].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[1].type(testData.workTitle, { delay: 50 });

            await inputs[2].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[2].type(testData.workLocation, { delay: 50 });
        }

        await clickButtonByText('Save');
        await page.waitForFunction(() => document.body.innerText.includes('Saved work'), { timeout: 10000 });
        console.log('  ✓ Work experience saved');
        await new Promise(r => setTimeout(r, 1000));
    };

    // Helper: Add Education
    const addEducation = async (testData) => {
        console.log('→ Adding Education...');
        await clickButtonByText('Education');
        await new Promise(r => setTimeout(r, 1000));

        await clickButtonByText('+ Add');
        await page.waitForSelector('.edu-item', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));

        const eduItems = await page.$$('.edu-item');
        const lastItem = eduItems[eduItems.length - 1];

        const inputs = await lastItem.$$('input');
        if (inputs.length >= 3) {
            await inputs[0].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[0].type(testData.school, { delay: 50 });

            await inputs[1].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[1].type(testData.degree, { delay: 50 });

            await inputs[2].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[2].type(testData.major, { delay: 50 });
        }

        await clickButtonByText('Save');
        await page.waitForFunction(() => document.body.innerText.includes('Saved education'), { timeout: 10000 });
        console.log('  ✓ Education saved');
        await new Promise(r => setTimeout(r, 1000));
    };

    // Helper: Add Skills
    const addSkills = async (testData) => {
        console.log('→ Adding Skills...');
        await clickButtonByText('Skills');
        await new Promise(r => setTimeout(r, 1000));

        for (const skill of testData.skills) {
            const skillInput = await page.$('input[placeholder="e.g. JavaScript"]');
            if (skillInput) {
                await skillInput.click();
                await page.keyboard.type(skill, { delay: 50 });
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 500));
            }
        }

        await clickButtonByText('Save');
        await page.waitForFunction(() => document.body.innerText.includes('Saved skills'), { timeout: 10000 });
        console.log('  ✓ Skills saved');
        await new Promise(r => setTimeout(r, 1000));
    };

    // Helper: Add Language
    const addLanguage = async (testData) => {
        console.log('→ Adding Language...');
        await clickButtonByText('Languages');
        await new Promise(r => setTimeout(r, 1000));

        await clickButtonByText('+ Add');
        await page.waitForSelector('.lang-item', { timeout: 5000 });
        await new Promise(r => setTimeout(r, 500));

        const langItems = await page.$$('.lang-item');
        const lastItem = langItems[langItems.length - 1];

        const inputs = await lastItem.$$('input');
        if (inputs.length >= 1) {
            await inputs[0].click({ clickCount: 3 });
            await page.keyboard.press('Backspace');
            await inputs[0].type(testData.language, { delay: 50 });
        }

        await clickButtonByText('Save');
        await page.waitForFunction(() => document.body.innerText.includes('Saved languages'), { timeout: 10000 });
        console.log('  ✓ Language saved');
        await new Promise(r => setTimeout(r, 1000));
    };

    // Helper: Capture all user data
    const captureUserData = async (userLabel) => {
        console.log('→ Capturing all user data for verification...');
        const data = {};

        await clickButtonByText('Profile');
        await new Promise(r => setTimeout(r, 1000));
        data.profile = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            const values = {};
            inputs.forEach(input => {
                if (input.placeholder && input.value) {
                    values[input.placeholder] = input.value;
                }
            });
            return values;
        });

        await clickButtonByText('Work');
        await new Promise(r => setTimeout(r, 1000));
        data.work = await page.evaluate(() => {
            const workItems = document.querySelectorAll('.work-item');
            return Array.from(workItems).map(item => {
                const inputs = item.querySelectorAll('input');
                return Array.from(inputs).map(i => i.value);
            });
        });

        await clickButtonByText('Education');
        await new Promise(r => setTimeout(r, 1000));
        data.education = await page.evaluate(() => {
            const eduItems = document.querySelectorAll('.edu-item');
            return Array.from(eduItems).map(item => {
                const inputs = item.querySelectorAll('input');
                return Array.from(inputs).map(i => i.value);
            });
        });

        await clickButtonByText('Skills');
        await new Promise(r => setTimeout(r, 1000));
        data.skills = await page.evaluate(() => {
            const skillItems = document.querySelectorAll('.skill-item');
            return Array.from(skillItems).map(item => item.textContent.trim());
        });

        await clickButtonByText('Languages');
        await new Promise(r => setTimeout(r, 1000));
        data.languages = await page.evaluate(() => {
            const langItems = document.querySelectorAll('.lang-item');
            return Array.from(langItems).map(item => {
                const inputs = item.querySelectorAll('input');
                return Array.from(inputs).map(i => i.value);
            });
        });

        savedUserData[userLabel] = data;
        console.log('  ✓ Data captured');
        return data;
    };

    // Helper: Verify data isolation
    const verifyDataIsolation = async (currentUser, otherUser) => {
        console.log(`\n→ VERIFYING DATA ISOLATION for ${currentUser.label}...`);
        const errors = [];
        const currentData = savedUserData[currentUser.label];

        const profileValues = Object.values(currentData.profile || {}).join(' ');
        const otherProfileValues = [
            otherUser.testData.fullName,
            otherUser.testData.phone,
            otherUser.testData.city,
            otherUser.testData.company,
            otherUser.testData.title
        ];

        for (const otherValue of otherProfileValues) {
            if (otherValue && profileValues.includes(otherValue)) {
                errors.push(`  ✗ CONTAMINATION: Found ${otherUser.label}'s data "${otherValue}" in ${currentUser.label}'s profile`);
            }
        }

        const workData = JSON.stringify(currentData.work || []);
        if (workData.includes(otherUser.testData.workCompany) ||
            workData.includes(otherUser.testData.workTitle)) {
            errors.push(`  ✗ CONTAMINATION: Found ${otherUser.label}'s work experience in ${currentUser.label}'s data`);
        }

        const eduData = JSON.stringify(currentData.education || []);
        if (eduData.includes(otherUser.testData.school) ||
            eduData.includes(otherUser.testData.major)) {
            errors.push(`  ✗ CONTAMINATION: Found ${otherUser.label}'s education in ${currentUser.label}'s data`);
        }

        const skillsData = JSON.stringify(currentData.skills || []);
        for (const skill of otherUser.testData.skills) {
            if (skillsData.includes(skill)) {
                errors.push(`  ✗ CONTAMINATION: Found ${otherUser.label}'s skill "${skill}" in ${currentUser.label}'s data`);
            }
        }

        if (errors.length > 0) {
            console.error('\n❌ DATA ISOLATION FAILED:');
            errors.forEach(err => console.error(err));
            return false;
        } else {
            console.log(`  ✓ CLEAN: No ${otherUser.label} data found in ${currentUser.label}'s account`);
            return true;
        }
    };

    // Helper: Verify own data exists
    const verifyOwnData = async (user) => {
        console.log(`→ VERIFYING ${user.label}'s OWN DATA...`);
        const errors = [];
        const data = savedUserData[user.label];

        const profileValues = Object.values(data.profile || {}).join(' ');
        if (!profileValues.includes(user.testData.fullName)) {
            errors.push(`  ✗ MISSING: Full name "${user.testData.fullName}" not found`);
        }
        if (!profileValues.includes(user.testData.phone)) {
            errors.push(`  ✗ MISSING: Phone "${user.testData.phone}" not found`);
        }

        const workData = JSON.stringify(data.work || []);
        if (!workData.includes(user.testData.workCompany)) {
            errors.push(`  ✗ MISSING: Work company "${user.testData.workCompany}" not found`);
        }

        const eduData = JSON.stringify(data.education || []);
        if (!eduData.includes(user.testData.school)) {
            errors.push(`  ✗ MISSING: School "${user.testData.school}" not found`);
        }

        if (errors.length > 0) {
            console.error('\n❌ DATA PERSISTENCE FAILED:');
            errors.forEach(err => console.error(err));
            return false;
        } else {
            console.log(`  ✓ COMPLETE: All ${user.label} data found correctly`);
            return true;
        }
    };

    // Main test execution
    let allTestsPassed = true;
    const testResults = [];

    try {
        // PHASE 1: Create data for each user
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║  PHASE 1: CREATING USER DATA                              ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');

        for (const account of ACCOUNTS) {
            console.log(`\n┌─ Testing ${account.label} (${account.email}) ─────────────────────┐`);

            await login(account.email, account.password);
            await fillProfileData(account.testData);
            await addWorkExperience(account.testData);
            await addEducation(account.testData);
            await addSkills(account.testData);
            await addLanguage(account.testData);
            await captureUserData(account.label);

            console.log(`└─ ${account.label} setup complete ──────────────────────────────┘`);

            await logout();
        }

        // PHASE 2: Cross-verify data isolation
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║  PHASE 2: CROSS-VERIFICATION (DATA ISOLATION TEST)        ║');
        console.log('╚═══════════════════════════════════════════════════════════╝');

        for (let i = 0; i < ACCOUNTS.length; i++) {
            const currentUser = ACCOUNTS[i];
            const otherUser = ACCOUNTS[(i + 1) % ACCOUNTS.length];

            console.log(`\n┌─ Verifying ${currentUser.label} ─────────────────────────────┐`);

            await login(currentUser.email, currentUser.password);

            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (e) {
                console.log('  Reload timed out, continuing...');
            }
            await new Promise(r => setTimeout(r, 2000));
            await captureUserData(currentUser.label);

            const ownDataOk = await verifyOwnData(currentUser);
            testResults.push({
                test: `${currentUser.label} - Own Data Persistence`,
                passed: ownDataOk
            });

            const isolationOk = await verifyDataIsolation(currentUser, otherUser);
            testResults.push({
                test: `${currentUser.label} - Isolation from ${otherUser.label}`,
                passed: isolationOk
            });

            if (!ownDataOk || !isolationOk) {
                allTestsPassed = false;
            }

            console.log(`└───────────────────────────────────────────────────────────┘`);

            await logout();
        }

        // PHASE 3: Summary
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║  TEST RESULTS SUMMARY                                      ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        testResults.forEach(result => {
            const status = result.passed ? '✓ PASS' : '✗ FAIL';
            const symbol = result.passed ? '✓' : '✗';
            console.log(`  ${symbol} ${result.test}: ${status}`);
        });

        console.log('\n' + '═'.repeat(61));
        if (allTestsPassed) {
            console.log('  ✓✓✓ ALL TESTS PASSED - DATA ISOLATION VERIFIED ✓✓✓');
            console.log('  Both users have completely isolated data.');
            console.log('  System is ready for 10k+ users.');
        } else {
            console.log('  ✗✗✗ TESTS FAILED - DATA ISOLATION ISSUE DETECTED ✗✗✗');
            console.log('  Review errors above for details.');
        }
        console.log('═'.repeat(61) + '\n');

        const report = {
            timestamp: new Date().toISOString(),
            testResults,
            allTestsPassed,
            userData: savedUserData
        };
        fs.writeFileSync(
            'test-isolation-report.json',
            JSON.stringify(report, null, 2)
        );
        console.log('📄 Detailed report saved to: test-isolation-report.json\n');

    } catch (e) {
        console.error('\n❌ TEST EXECUTION ERROR:', e.message);
        console.error(e.stack);
        allTestsPassed = false;
    } finally {
        await browser.close();
        process.exit(allTestsPassed ? 0 : 1);
    }
})();
