# MCP Server Tests

This directory contains unit and integration tests for the FixiPlug MCP server.

## Test Structure

```
tests/
├── core/
│   └── types.test.ts          # Core types and utilities
├── tools.test.ts              # Tool schemas validation
├── agent-executor.test.ts     # AgentExecutor logic
├── browser.test.ts            # BrowserManager
├── e2e/
│   └── integration.test.ts    # End-to-end integration tests
└── README.md
```

## Running Tests

### Install Dependencies

```bash
npm install
```

### Run All Unit Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test -- tests/tools.test.ts
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

Coverage report will be generated in `coverage/` directory.

## Unit Tests

Unit tests mock external dependencies and test individual components in isolation.

**What they test:**
- Response format consistency
- Error handling
- Configuration validation
- Schema validation
- Tool parameter validation

**Running unit tests:**
```bash
npm test -- --testPathIgnorePatterns=e2e
```

This runs all tests except E2E tests.

## End-to-End (E2E) Tests

E2E tests require a running Django server and test the complete integration.

### Prerequisites

1. **Django server running:**
   ```bash
   # In your Django project
   python manage.py runserver
   ```

2. **dj-fixi installed and configured:**
   - FixiPlug built and integrated
   - Agent test page available at `/experimental/agent-test/`
   - Course CRUD view at `/experimental/courses/`

### Running E2E Tests

```bash
# Set environment variables
export E2E_TESTS=true
export DJANGO_BASE_URL=http://localhost:8000
export HEADLESS=true  # Optional: set to false to see browser

# Run E2E tests only
npm test -- tests/e2e/integration.test.ts
```

**E2E tests verify:**
- Direct API calls
- Browser automation
- Data extraction
- Navigation
- Error handling
- Performance characteristics
- Response format consistency

### E2E Test Timeouts

E2E tests have longer timeouts (up to 30s) to accommodate:
- Browser startup
- Page loads
- Network latency
- Django response time

## Test Configuration

### Jest Configuration

See [jest.config.js](../jest.config.js) for test configuration.

Key settings:
- Uses `ts-jest` for TypeScript support
- ESM module support
- Coverage collection from `src/**/*.ts`

### Environment Variables

| Variable | Description | Default | Used In |
|----------|-------------|---------|---------|
| `E2E_TESTS` | Enable E2E tests | `false` | E2E tests |
| `DJANGO_BASE_URL` | Django server URL | `http://localhost:8000` | E2E tests |
| `HEADLESS` | Run browser headless | `true` | E2E tests |

## Writing Tests

### Unit Test Example

```typescript
import { successResponse } from '../src/core/types.js';

describe('My Feature', () => {
  it('should do something', () => {
    const result = successResponse({ value: 42 });

    expect(result.success).toBe(true);
    expect(result.data.value).toBe(42);
  });
});
```

### E2E Test Example

```typescript
const testIf = process.env.E2E_TESTS === 'true' ? it : it.skip;

testIf('should query courses', async () => {
  const result = await executor.queryCourses({ limit: 10 });

  expect(result.success).toBe(true);
  expect(result.data).toBeDefined();
}, 10000); // 10s timeout
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --testPathIgnorePatterns=e2e

  e2e-tests:
    runs-on: ubuntu-latest
    services:
      django:
        image: your-django-image
        ports:
          - 8000:8000
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install chromium
      - run: |
          export E2E_TESTS=true
          export DJANGO_BASE_URL=http://localhost:8000
          npm test -- tests/e2e/integration.test.ts
```

## Troubleshooting

### "Cannot find module" errors

Make sure to build TypeScript first:
```bash
npm run build
```

### E2E tests always skip

Enable them with environment variable:
```bash
E2E_TESTS=true npm test
```

### Browser fails to start

Install Playwright browsers:
```bash
npx playwright install chromium
```

### Tests timeout

Increase Jest timeout in the test:
```typescript
it('long test', async () => {
  // ...
}, 60000); // 60 second timeout
```

### Django not responding

1. Verify Django is running: `curl http://localhost:8000`
2. Check Django logs
3. Try non-headless mode: `HEADLESS=false`

## Coverage Goals

Target coverage:
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Best Practices

1. **Unit tests should be fast** (< 100ms each)
2. **E2E tests can be slow** but should complete within timeouts
3. **Mock external dependencies** in unit tests
4. **Use descriptive test names** that explain what is being tested
5. **One assertion per test** when possible
6. **Test error cases** as well as success cases
7. **Clean up resources** in `afterEach`/`afterAll` hooks
8. **Use skip for conditional tests** (E2E, feature flags)

## Related Documentation

- [Setup Guide](../docs/SETUP.md) - Initial setup
- [API Reference](../docs/API.md) - Tool documentation
- [Examples](../docs/EXAMPLES.md) - Usage examples
- [Validation](../../MCP_SERVER_VALIDATION.md) - Validation results
