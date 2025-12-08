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
    const filePath = `file://${path.join(__dirname, 'mock-lazy-dropdown.html')}`;

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
    console.log('WAITING 3 SECONDS so you can see the empty form...');
    await new Promise(r => setTimeout(r, 3000));

    // 4. Trigger Autofill
    console.log('TRIGGERING AUTOFILL...');
    await page.evaluate(() => {
        if (window.fillFormCallback) {
            window.fillFormCallback({
                type: 'FILL_FORM',
                profile: {
                    country: 'United States',
                    city: 'Seattle', // Added city to show more filling
                    state: 'Washington'
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
