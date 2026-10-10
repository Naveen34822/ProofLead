const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1470, height: 755 } });
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:3001/');
    
    // Step 1: Wait for ICP and click "DevTools" and "Productivity" then Submit
    await page.waitForSelector('button.chip:has-text("DevTools")');
    await page.click('button.chip:has-text("DevTools")');
    await page.click('button.chip:has-text("Productivity")');
    await page.click('button:has-text("Continue to Company Upload")');
    
    // Step 2: Load sample dataset
    await page.waitForSelector('button:has-text("Use Sample Dataset")');
    await page.click('button:has-text("Use Sample Dataset")');
    
    // Wait for enriching overlay to disappear (allow 120s)
    await page.waitForSelector('.enriching-overlay', { state: 'hidden', timeout: 120000 });
    
    // Wait for the table to appear (allow 120s)
    await page.waitForSelector('.results-table-container', { timeout: 120000 });
    
    // Screenshot: results table
    await page.screenshot({ path: 'docs/screenshots/results_table.png', fullPage: false });
    console.log("Screenshot saved: docs/screenshots/results_table.png");
    
    // Screenshot: Supabase detail panel
    await page.click('tr:has-text("supabase.com")');
    await page.waitForSelector('.detail-panel');
    await page.waitForTimeout(1000); // Wait for animation
    await page.screenshot({ path: 'docs/screenshots/supabase_panel.png' });
    console.log("Screenshot saved: docs/screenshots/supabase_panel.png");
    await page.click('.panel-close');
    
    // Screenshot: Notion detail panel
    await page.click('tr:has-text("notion.so")');
    await page.waitForSelector('.detail-panel');
    await page.waitForTimeout(1000); // Wait for animation
    await page.screenshot({ path: 'docs/screenshots/notion_panel.png' });
    console.log("Screenshot saved: docs/screenshots/notion_panel.png");
    await page.click('.panel-close');
    
    // Screenshot: Loom panel
    await page.click('tr:has-text("loom.com")');
    await page.waitForSelector('.detail-panel');
    await page.waitForTimeout(1000); // Wait for animation
    await page.screenshot({ path: 'docs/screenshots/loom_panel.png' });
    console.log("Screenshot saved: docs/screenshots/loom_panel.png");
    
  } catch (err) {
    console.error("Playwright error:", err);
  } finally {
    await browser.close();
  }
})();
