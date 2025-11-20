import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';

/**
 * Automated browser test for DOM delegation event types
 * Tests all 8 event types: click, dblclick, mouseenter, change, input, focus, submit, keydown
 */

async function runTests() {
  console.log('='.repeat(70));
  console.log('DOM DELEGATION EVENT TYPES TEST');
  console.log('='.repeat(70));

  const browser = await chromium.launch({
    headless: true,
    // Set to false for debugging: headless: false
  });
  const page = await browser.newPage();

  // Capture console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ type: msg.type(), text });

    // Show important logs
    if (text.includes('[Event Fired]') || text.includes('[Event Success]') || text.includes('[Event Error]')) {
      console.log(`  ${text}`);
    }
  });

  // Capture page errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`  ❌ Page Error: ${error.message}`);
  });

  try {
    console.log('\n📄 Loading DOM delegation demo...');
    await page.goto(`${BASE_URL}/dom-delegation-demo.html`, {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Wait for FixiPlug to initialize
    await page.waitForTimeout(1500);

    console.log('✅ Page loaded\n');

    // Test results tracking
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    // ==============================================
    // TEST 1: Click Event
    // ==============================================
    console.log('🧪 Test 1: Click Event');
    try {
      const initialCount = await page.textContent('#click-count');
      await page.click('button[fx-action="/api/event-test/click"]');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#click-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Click Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Click Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 2: Double Click Event
    // ==============================================
    console.log('\n🧪 Test 2: Double Click Event');
    try {
      const initialCount = await page.textContent('#dblclick-count');
      await page.dblclick('button[fx-action="/api/event-test/dblclick"]');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#dblclick-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Double Click Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Double Click Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 3: Mouse Enter Event
    // ==============================================
    console.log('\n🧪 Test 3: Mouse Enter Event');
    try {
      const initialCount = await page.textContent('#mouseenter-count');
      await page.hover('div[fx-action="/api/event-test/mouseenter"]');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#mouseenter-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Mouse Enter Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Mouse Enter Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 4: Change Event (select)
    // ==============================================
    console.log('\n🧪 Test 4: Change Event');
    try {
      const initialCount = await page.textContent('#change-count');
      await page.selectOption('select[fx-action="/api/event-test/change"]', 'a');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#change-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Change Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Change Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 5: Input Event
    // ==============================================
    console.log('\n🧪 Test 5: Input Event');
    try {
      const initialCount = await page.textContent('#input-count');
      const inputEl = page.locator('input[fx-action="/api/event-test/input"]');
      await inputEl.fill('test');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#input-count');

      // Input event fires for each character typed
      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Input Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Input Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 6: Focus Event
    // ==============================================
    console.log('\n🧪 Test 6: Focus Event');
    try {
      const initialCount = await page.textContent('#focus-count');
      await page.focus('input[fx-action="/api/event-test/focus"]');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#focus-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Focus Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Focus Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 7: Submit Event
    // ==============================================
    console.log('\n🧪 Test 7: Submit Event');
    try {
      const initialCount = await page.textContent('#submit-count');

      // Fill in the form input first
      await page.fill('form[fx-action="/api/event-test/submit"] input[name="data"]', 'test data');

      // Click the submit button
      await page.click('form[fx-action="/api/event-test/submit"] button[type="submit"]');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#submit-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Submit Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Submit Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 8: Keydown Event
    // ==============================================
    console.log('\n🧪 Test 8: Keydown Event');
    try {
      const initialCount = await page.textContent('#keydown-count');
      const keydownInput = page.locator('input[fx-action="/api/event-test/keydown"]');
      await keydownInput.focus();
      await page.keyboard.press('a');
      await page.waitForTimeout(300);
      const newCount = await page.textContent('#keydown-count');

      const passed = parseInt(newCount) > parseInt(initialCount);
      results.tests.push({ name: 'Keydown Event', passed });

      if (passed) {
        console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Counter did not increment: ${initialCount} → ${newCount}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Keydown Event', passed: false });
      results.failed++;
    }

    // ==============================================
    // TEST 9: Delegation Statistics
    // ==============================================
    console.log('\n🧪 Test 9: Delegation Statistics');
    try {
      // Click the show event counts button
      await page.evaluate(() => window.showEventCounts());
      await page.waitForTimeout(200);

      // Get delegation stats
      const stats = await page.evaluate(() => {
        return {
          elementsHandled: document.getElementById('elementsHandled')?.textContent,
          listenersAttached: document.getElementById('listenersAttached')?.textContent,
          memoryReduction: document.getElementById('memoryReduction')?.textContent
        };
      });

      const elementsHandled = parseInt(stats.elementsHandled || '0');
      const listenersAttached = parseInt(stats.listenersAttached || '0');

      // Verify delegation is working (many elements, few listeners)
      const passed = elementsHandled > 100 && listenersAttached <= 10;
      results.tests.push({ name: 'Delegation Statistics', passed });

      if (passed) {
        console.log(`  ✅ PASS - Elements: ${elementsHandled}, Listeners: ${listenersAttached}, Memory: ${stats.memoryReduction}`);
        results.passed++;
      } else {
        console.log(`  ❌ FAIL - Elements: ${elementsHandled}, Listeners: ${listenersAttached}`);
        results.failed++;
      }
    } catch (error) {
      console.log(`  ❌ FAIL - ${error.message}`);
      results.tests.push({ name: 'Delegation Statistics', passed: false });
      results.failed++;
    }

    // ==============================================
    // SUMMARY
    // ==============================================
    console.log('\n' + '='.repeat(70));
    console.log('TEST SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Tests:  ${results.passed + results.failed}`);
    console.log(`Passed:       ${results.passed} ✅`);
    console.log(`Failed:       ${results.failed} ❌`);
    console.log('='.repeat(70));

    // Show failed tests
    if (results.failed > 0) {
      console.log('\nFailed Tests:');
      results.tests.filter(t => !t.passed).forEach(t => {
        console.log(`  ❌ ${t.name}`);
      });
    }

    // Show page errors if any
    if (errors.length > 0) {
      console.log('\n⚠️  Page Errors:');
      errors.forEach(e => console.log(`  - ${e}`));
    }

    // Check for event fired logs
    const eventFiredLogs = consoleLogs.filter(l => l.text.includes('[Event Fired]'));
    console.log(`\n📊 Total events fired: ${eventFiredLogs.length}`);

    await browser.close();

    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    await browser.close();
    process.exit(1);
  }
}

// Run tests
runTests();
