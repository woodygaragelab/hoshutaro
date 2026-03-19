import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[ERROR] ${msg.text()}`);
    } else {
      if (msg.text().includes('error') || msg.text().includes('TypeError') || msg.text().includes('Error')) {
         console.log(`[WARN] ${msg.text()}`);
      }
    }
  });

  page.on('pageerror', error => {
    console.log(`[UNHANDLED] ${error.message} \n ${error.stack}`);
  });

  try {
    let connected = false;
    for (let port of [5174, 5173, 5175]) {
       try {
          console.log(`Trying ${port}...`);
          // Ignore timeout errors
          await page.goto(`http://localhost:${port}/`).catch(e => {});
          await page.waitForSelector('#root', { timeout: 5000 });
          connected = true;
          break;
       } catch(e) {}
    }

    if (!connected) process.exit(1);
    
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

    await page.waitForTimeout(2000);

    // Change scale
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for(const btn of buttons) {
        if (btn.textContent && (btn.textContent.includes('月') || btn.textContent.includes('週'))) {
           btn.click();
           return;
        }
      }
    });

    await page.waitForTimeout(5000);

  } catch (err) {
    console.log(err);
  } finally {
    await browser.close();
  }
})();
