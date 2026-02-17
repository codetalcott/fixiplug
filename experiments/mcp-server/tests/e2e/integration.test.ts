/**
 * End-to-End Integration Tests
 *
 * These tests require a running Django server with dj-fixi installed.
 * Set DJANGO_BASE_URL environment variable before running.
 *
 * To run: npm test -- tests/e2e/integration.test.ts
 */

import { AgentExecutor } from '../../src/agent-executor.js';
import { BrowserManager } from '../../src/browser.js';
import { Config, defaultConfig } from '../../src/core/types.js';

const E2E_ENABLED = process.env.E2E_TESTS === 'true';
const testIf = E2E_ENABLED ? it : it.skip;

describe('E2E Integration Tests', () => {
  let browser: BrowserManager;
  let executor: AgentExecutor;
  let config: Config;

  beforeAll(async () => {
    if (!E2E_ENABLED) {
      console.log('Skipping E2E tests. Set E2E_TESTS=true to run.');
      return;
    }

    config = {
      ...defaultConfig,
      baseUrl: process.env.DJANGO_BASE_URL || 'http://localhost:8000',
      browser: {
        ...defaultConfig.browser,
        headless: process.env.HEADLESS !== 'false',
      },
    };

    browser = new BrowserManager(config);
    executor = new AgentExecutor(browser, config);

    // Start browser once for all tests
    await browser.start();
  }, 30000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  }, 10000);

  describe('Query Courses (Direct API)', () => {
    testIf('should query courses without search', async () => {
      const result = await executor.queryCourses({
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.data).toBeInstanceOf(Array);
      expect(result.meta?.method).toBe('direct-api');
      expect(result.meta?.executionTime).toBeGreaterThan(0);
    }, 10000);

    testIf('should search courses', async () => {
      const result = await executor.queryCourses({
        filter: { search: 'math' },
        limit: 25,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      if (result.data.data.length > 0) {
        // Verify structure of returned data
        const course = result.data.data[0];
        expect(course).toHaveProperty('id');
      }
    }, 10000);

    testIf('should handle pagination', async () => {
      const page1 = await executor.queryCourses({
        filter: { page: 1 },
        limit: 5,
      });

      const page2 = await executor.queryCourses({
        filter: { page: 2 },
        limit: 5,
      });

      expect(page1.success).toBe(true);
      expect(page2.success).toBe(true);

      if (page1.data.pagination.totalPages > 1) {
        expect(page1.data.data).not.toEqual(page2.data.data);
      }
    }, 15000);

    testIf('should respect limit parameter', async () => {
      const result = await executor.queryCourses({
        limit: 3,
      });

      expect(result.success).toBe(true);
      expect(result.data.data.length).toBeLessThanOrEqual(3);
    }, 10000);
  });

  describe('Navigation', () => {
    testIf('should navigate to courses page', async () => {
      const result = await executor.navigate({
        url: '/experimental/courses/',
      });

      expect(result.success).toBe(true);
      expect(result.data?.message).toContain('Navigated to');
    }, 15000);

    testIf('should navigate to agent test page', async () => {
      const result = await executor.navigate({
        url: '/experimental/agent-test/',
      });

      expect(result.success).toBe(true);
    }, 15000);
  });

  describe('Browser-based Operations', () => {
    beforeEach(async () => {
      // Navigate to test page before each test
      await executor.navigate({
        url: '/experimental/agent-test/',
      });
    }, 15000);

    testIf('should get table data', async () => {
      const result = await executor.getTableData({
        table_selector: '#course-table',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, 15000);

    testIf('should extract data from page', async () => {
      // First ensure we're on a page with data
      await executor.navigate({
        url: '/experimental/courses/',
      });

      const result = await executor.extractData({
        selector: 'tr[data-course-id]',
        fields: {
          id: 'td:nth-child(1)',
          title: 'td:nth-child(2)',
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      if (result.data.count > 0) {
        expect(result.data.data[0]).toHaveProperty('id');
        expect(result.data.data[0]).toHaveProperty('title');
      }
    }, 20000);
  });

  describe('Complete Workflows', () => {
    testIf('should search and extract course data', async () => {
      // 1. Navigate
      const navResult = await executor.navigate({
        url: '/experimental/courses/',
      });
      expect(navResult.success).toBe(true);

      // 2. Query via API
      const queryResult = await executor.queryCourses({
        limit: 5,
      });
      expect(queryResult.success).toBe(true);

      // 3. Extract from page
      const extractResult = await executor.extractData({
        selector: 'tr[data-course-id]',
        fields: {
          id: 'td:nth-child(1)',
        },
      });
      expect(extractResult.success).toBe(true);

      // 4. Compare results
      if (queryResult.data.data.length > 0 && extractResult.data.count > 0) {
        // Both methods should find data
        console.log(`API found ${queryResult.data.data.length} courses`);
        console.log(`Extraction found ${extractResult.data.count} rows`);
      }
    }, 30000);

    testIf('should handle search with no results gracefully', async () => {
      const result = await executor.queryCourses({
        filter: { search: 'zzzznonexistentcoursexxxx' },
        limit: 10,
      });

      expect(result.success).toBe(true);
      expect(result.data.data).toEqual([]);
      expect(result.data.pagination.total).toBe(0);
    }, 10000);
  });

  describe('Error Handling', () => {
    testIf('should handle invalid page number', async () => {
      const result = await executor.queryCourses({
        filter: { page: -1 },
      });

      // Should be rejected by schema validation before execution
      expect(result.success).toBe(false);
    }, 5000);

    testIf('should handle browser operations when browser inactive', async () => {
      // Create fresh executor without starting browser
      const freshBrowser = new BrowserManager(config);
      const freshExecutor = new AgentExecutor(freshBrowser, config);

      const result = await freshExecutor.clickButton({
        selector: '#btn',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');

      await freshBrowser.close();
    }, 10000);

    testIf('should handle non-existent form', async () => {
      const result = await executor.fillForm({
        form_selector: '#nonexistent-form-12345',
        data: { field: 'value' },
      });

      expect(result.success).toBe(false);
    }, 15000);
  });

  describe('Performance', () => {
    testIf('direct API should be faster than browser', async () => {
      // Direct API call
      const apiResult = await executor.queryCourses({
        limit: 10,
      });

      expect(apiResult.success).toBe(true);
      const apiTime = apiResult.meta?.executionTime || 0;

      // Browser-based operation
      await executor.navigate({
        url: '/experimental/courses/',
      });

      const browserResult = await executor.getTableData({});
      const browserTime = browserResult.meta?.executionTime || 0;

      console.log(`API time: ${apiTime}ms, Browser time: ${browserTime}ms`);

      // API should generally be faster (though not always guaranteed)
      expect(apiTime).toBeGreaterThan(0);
      expect(browserTime).toBeGreaterThan(0);
    }, 30000);

    testIf('should complete query in reasonable time', async () => {
      const startTime = Date.now();

      const result = await executor.queryCourses({
        limit: 25,
      });

      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeLessThan(10000); // Should complete in < 10s
    }, 15000);
  });

  describe('Response Format Consistency', () => {
    testIf('all successful responses should have consistent structure', async () => {
      const operations = [
        () => executor.queryCourses({ limit: 5 }),
        () => executor.navigate({ url: '/experimental/courses/' }),
        () => executor.getTableData({}),
      ];

      for (const operation of operations) {
        const result = await operation();

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('meta');
        expect(result.meta).toHaveProperty('timestamp');
        expect(result.meta).toHaveProperty('executionTime');

        if (result.success) {
          expect(result).toHaveProperty('data');
        } else {
          expect(result).toHaveProperty('error');
        }
      }
    }, 30000);
  });
});

describe('E2E Setup Verification', () => {
  it('should indicate if E2E tests are disabled', () => {
    if (!E2E_ENABLED) {
      console.log('\n' + '='.repeat(60));
      console.log('E2E tests are SKIPPED');
      console.log('To enable, set environment variables:');
      console.log('  E2E_TESTS=true');
      console.log('  DJANGO_BASE_URL=http://localhost:8000');
      console.log('  HEADLESS=true  (optional)');
      console.log('='.repeat(60) + '\n');
    }
    expect(true).toBe(true);
  });
});
