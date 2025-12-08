const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    // 1. Launch Visible Browser
    console.log('Launching browser (Visual Mode)...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });

    const page = await browser.pages().then(pages => pages[0]);
    const filePath = `file://${path.join(__dirname, 'mock-job-preferences.html')}`;

    console.log(`Navigating to mock form: ${filePath}`);
    await page.goto(filePath);

    // 2. Prepare Environment (Mock Chrome API)
    await page.evaluate(() => {
        window.chrome = {
            runtime: {
                onMessage: {
                    addListener: (callback) => {
                        console.log('Chrome listener registered');
                        window.fillFormCallback = callback;
                    }
                }
            }
        };
    });

    // 3. Inject Actual Extension Logic
    console.log('Injecting content.js logic...');
    const contentScriptPath = path.join(__dirname, '../job-filler-extension/content.js');
    const contentScript = fs.readFileSync(contentScriptPath, 'utf8');
    await page.evaluate(contentScript);

    console.log('Extension logic loaded.');
    console.log('WAITING 2 SECONDS...');
    await new Promise(r => setTimeout(r, 2000));

    // 4. Trigger Autofill
    console.log('TRIGGERING AUTOFILL...');
    await page.evaluate(() => {
        if (window.fillFormCallback) {
            window.fillFormCallback({
                type: 'FILL_FORM',
                profile: {
                    // Standard
                    fullName: "Vijay Putta",
                    email: "vijay@test.com",
                    phones: "555-0199",

                    // New Preferences
                    question_hear_about: "LinkedIn",
                    question_used_product: "Yes",
                    question_worked_before: "No",
                    question_work_auth: "Yes",
                    question_sponsorship: "No",
                    question_office_location: "New York, NY",
                    question_conflict_interest: "Yes",
                    question_conflict_details: "My brother works there",
                    question_gov_official: "No",
                    question_gender: "Male",
                    race: "Asian",
                    veteran_status: "Not a Veteran",
                    disability_status: "No",
                    question_lgbtq: "No"
                }
            }, {}, (resp) => console.log('Response:', resp));
        } else {
            console.error('Fill callback not registered!');
        }
    });

    console.log('Autofill triggered. Watch the browser!');

    // 5. Keep Open for Viewing
    console.log('Browser will remain open for 30 seconds...');
    await new Promise(r => setTimeout(r, 30000));

    await browser.close();
})();
