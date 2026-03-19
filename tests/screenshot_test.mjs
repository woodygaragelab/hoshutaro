import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  // Use non-headless mode if possible, but headless works for screenshots too
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set viewport to a realistic desktop size
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    let connected = false;
    for (let port of [5173, 5174, 5175]) {
       try {
          console.log(`Trying ${port}...`);
          await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded', timeout: 5000 });
          connected = true;
          break;
       } catch(e) {}
    }

    if (!connected) {
       console.log("Could not connect to Vite server");
       process.exit(1);
    }
    
    await page.waitForTimeout(2000);

    // Switch to task-based mode
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="checkbox"]');
      for(const input of inputs) {
         const parentLabel = input.closest('label');
         if (parentLabel && parentLabel.textContent && parentLabel.textContent.includes('モード')) {
            input.click();
            return;
         }
      }
    });

    console.log("Switched to task-based mode. Waiting 2s.");
    await page.waitForTimeout(2000);

    // Change scale to Week/Month
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for(const btn of buttons) {
        if (btn.textContent && (btn.textContent.includes('月') || btn.textContent.includes('週'))) {
           btn.click();
           return;
        }
      }
    });

    console.log("Switched Time Scale. Waiting 3s for the issue to appear...");
    await page.waitForTimeout(3000);
    
    // Take a screenshot of the entire page to see if there's a React Error Overlay or blank screen
    await page.screenshot({ path: 'tests/error_state.png', fullPage: true });
    console.log("Screenshot saved to tests/error_state.png");

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await browser.close();
  }
})();
