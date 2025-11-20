# Browser Testing with Playwright

This directory contains automated browser tests using Playwright to validate DOM event delegation functionality.

## Overview

The browser tests automate interactions with the DOM delegation demo to verify that all event types are properly delegated and functioning correctly.

## Prerequisites

Playwright is installed as a dev dependency in the playground package:

```bash
cd playground
npm install
```

## Running Tests

### Start the server first

```bash
cd playground
npm start
```

### Run the automated browser test (in another terminal)

```bash
cd playground
npm run test:browser
```

Or run directly:

```bash
node test/dom-delegation-events.test.mjs
```

## Test Coverage

The automated test validates **9 scenarios**:

1. **Click Event** - Tests standard click interactions
2. **Double Click Event** - Tests dblclick event delegation
3. **Mouse Enter Event** - Tests mouseenter hover interactions
4. **Change Event** - Tests change events on select dropdowns
5. **Input Event** - Tests input events on text fields
6. **Focus Event** - Tests focus events on form fields
7. **Submit Event** - Tests form submission
8. **Keydown Event** - Tests keyboard input
9. **Delegation Statistics** - Verifies memory reduction and listener efficiency

## Test Structure

Each test follows this pattern:

```javascript
console.log('🧪 Test N: Event Type');
try {
  // 1. Get initial counter value
  const initialCount = await page.textContent('#eventtype-count');

  // 2. Trigger the event (click, hover, type, etc.)
  await page.click('button[fx-action="/api/event-test/click"]');

  // 3. Wait for event processing
  await page.waitForTimeout(300);

  // 4. Get new counter value
  const newCount = await page.textContent('#eventtype-count');

  // 5. Verify counter incremented
  const passed = parseInt(newCount) > parseInt(initialCount);

  if (passed) {
    console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
  } else {
    console.log(`  ❌ FAIL`);
  }
} catch (error) {
  console.log(`  ❌ FAIL - ${error.message}`);
}
```

## Playwright Actions Used

The test demonstrates various Playwright automation capabilities:

| Action | Method | Example |
|--------|--------|---------|
| Click | `page.click()` | `await page.click('button')` |
| Double Click | `page.dblclick()` | `await page.dblclick('button')` |
| Hover | `page.hover()` | `await page.hover('div')` |
| Type Text | `locator.fill()` | `await input.fill('text')` |
| Select Option | `page.selectOption()` | `await page.selectOption('select', 'a')` |
| Focus Element | `page.focus()` | `await page.focus('input')` |
| Press Key | `page.keyboard.press()` | `await page.keyboard.press('a')` |
| Evaluate JS | `page.evaluate()` | `await page.evaluate(() => {...})` |

## Expected Output

```
======================================================================
DOM DELEGATION EVENT TYPES TEST
======================================================================

📄 Loading DOM delegation demo...
✅ Page loaded

🧪 Test 1: Click Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 2: Double Click Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 3: Mouse Enter Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 4: Change Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 5: Input Event
  ✅ PASS - Counter: 0 → 4

🧪 Test 6: Focus Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 7: Submit Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 8: Keydown Event
  ✅ PASS - Counter: 0 → 1

🧪 Test 9: Delegation Statistics
  ✅ PASS - Elements: 104, Listeners: 4, Memory: ~96%

======================================================================
TEST SUMMARY
======================================================================
Total Tests:  9
Passed:       9 ✅
Failed:       0 ❌
======================================================================

📊 Total events fired: 9
```

## Debugging Tests

### Run in headed mode (see browser UI)

Edit [test/dom-delegation-events.test.mjs](dom-delegation-events.test.mjs) line 18:

```javascript
const browser = await chromium.launch({
  headless: false,  // Change from true to false
});
```

### View console logs

The test captures all console messages from the browser. Event-related logs are automatically displayed:

- `[Event Fired]` - When an event is triggered
- `[Event Success]` - When an event completes successfully
- `[Event Error]` - When an event fails

### Check page errors

All page errors are captured and displayed at the end of the test run.

## Adding New Tests

To test a new event type, follow this pattern:

```javascript
console.log('\n🧪 Test N: New Event Type');
try {
  const initialCount = await page.textContent('#newevent-count');

  // Trigger your event
  await page.PLAYWRIGHT_METHOD('selector[fx-action="/api/event-test/newevent"]');

  await page.waitForTimeout(300);
  const newCount = await page.textContent('#newevent-count');

  const passed = parseInt(newCount) > parseInt(initialCount);
  results.tests.push({ name: 'New Event Type', passed });

  if (passed) {
    console.log(`  ✅ PASS - Counter: ${initialCount} → ${newCount}`);
    results.passed++;
  } else {
    console.log(`  ❌ FAIL`);
    results.failed++;
  }
} catch (error) {
  console.log(`  ❌ FAIL - ${error.message}`);
  results.failed++;
}
```

## Related Resources

- [Playwright Documentation](https://playwright.dev/)
- [DOM Delegation Demo](../playground/frontend/dom-delegation-demo.html)
- [DOM Feature Initialization](../docs/DOM_FEATURE_INITIALIZATION.md)
- [Event Buffering Test](event-buffering.test.html)

## CI/CD Integration

To integrate with CI/CD:

```yaml
# .github/workflows/test.yml
- name: Install dependencies
  run: |
    cd playground
    npm install

- name: Start server
  run: |
    cd playground
    npm start &
    sleep 5

- name: Run browser tests
  run: |
    cd playground
    npm run test:browser
```

## Troubleshooting

### Test fails with timeout

Increase the timeout in the test file:

```javascript
await page.goto(`${BASE_URL}/dom-delegation-demo.html`, {
  waitUntil: 'networkidle',
  timeout: 30000  // Increase from 10000
});
```

### Browser doesn't close

Ensure `await browser.close()` is called in both success and error paths.

### Events not firing

1. Check that the server is running on port 3000
2. Verify element selectors match the HTML
3. Run in headed mode to see what's happening
4. Check console logs for errors

## Performance

The full test suite runs in approximately **5-8 seconds**:
- Page load: ~2 seconds
- Event tests: ~3-4 seconds (9 tests × 300ms wait)
- Teardown: ~1 second
