const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Target the locally running app or a provided URL
    const targetUrl = process.env.APP_URL || 'http://localhost:3000';
    
    try {
        await page.goto(targetUrl);
        await page.screenshot({ path: 'docs/visual_audit.png', fullPage: true });
        
        // Basic accessibility and DOM audit
        const metrics = await page.evaluate(() => {
            return {
                title: document.title,
                buttonCount: document.querySelectorAll('button').length,
                inputCount: document.querySelectorAll('input').length,
                imageCount: document.querySelectorAll('img').reduce((acc, img) => acc + (img.alt ? 0 : 1), 0), // Missing alt tags
                isResponsive: window.innerWidth < 1200
            };
        });

        // Write findings for the Visual Analyst agent
        fs.writeFileSync('docs/visual_metrics.json', JSON.stringify(metrics, null, 2));
        console.log("Visual Sweep completed. Metrics saved to docs/visual_metrics.json");
    } catch (e) {
        console.error("Visual Sweep failed:", e);
    } finally {
        await browser.close();
    }
})();
