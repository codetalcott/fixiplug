/**
 * Unit tests for BrowserManager
 */

import { BrowserManager } from '../src/browser.js';
import { Config, defaultConfig } from '../src/core/types.js';
import { Browser, Page } from 'playwright';

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn(),
  },
}));

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  let testConfig: Config;
  let mockBrowser: jest.Mocked<Browser>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    testConfig = {
      ...defaultConfig,
      baseUrl: 'http://localhost:8000',
    };

    // Create mock page
    mockPage = {
      goto: jest.fn(),
      waitForFunction: jest.fn(),
      evaluate: jest.fn(),
      content: jest.fn(),
      setDefaultTimeout: jest.fn(),
    } as any;

    // Create mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    } as any;

    const { chromium } = require('playwright');
    chromium.launch.mockResolvedValue(mockBrowser);

    browserManager = new BrowserManager(testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with config', () => {
      expect(browserManager).toBeDefined();
      expect(browserManager.isActive()).toBe(false);
    });
  });

  describe('start', () => {
    it('should launch browser and load page', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);

      await browserManager.start();

      const { chromium } = require('playwright');
      expect(chromium.launch).toHaveBeenCalledWith({
        headless: testConfig.browser.headless,
      });
      expect(mockBrowser.newPage).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(
        'http://localhost:8000/experimental/agent-test/',
        { waitUntil: 'domcontentloaded' }
      );
      expect(mockPage.waitForFunction).toHaveBeenCalledWith(
        "typeof window.fixiplug !== 'undefined'",
        { timeout: testConfig.browser.timeout.fixiplug }
      );
    });

    it('should set page timeout', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);

      await browserManager.start();

      expect(mockPage.setDefaultTimeout).toHaveBeenCalledWith(
        testConfig.browser.timeout.page
      );
    });

    it('should not start if already running', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);

      await browserManager.start();
      const { chromium } = require('playwright');
      const firstCallCount = chromium.launch.mock.calls.length;

      await browserManager.start();

      expect(chromium.launch.mock.calls.length).toBe(firstCallCount);
    });

    it('should cleanup on failure', async () => {
      mockPage.waitForFunction.mockRejectedValue(new Error('Timeout'));

      await expect(browserManager.start()).rejects.toThrow('Timeout');

      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('executeAgentCommand', () => {
    beforeEach(async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();
    });

    it('should execute command successfully', async () => {
      const mockResult = { id: 1, name: 'Test' };
      mockPage.evaluate.mockResolvedValue({
        success: true,
        data: mockResult,
      });

      const result = await browserManager.executeAgentCommand(
        'agent:test',
        { param: 'value' }
      );

      expect(result).toEqual(mockResult);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    it('should throw on command error', async () => {
      mockPage.evaluate.mockResolvedValue({
        success: false,
        error: 'Command failed',
      });

      await expect(
        browserManager.executeAgentCommand('agent:test', {})
      ).rejects.toThrow('Command failed');
    });

    it('should throw if browser not started', async () => {
      const freshManager = new BrowserManager(testConfig);

      await expect(
        freshManager.executeAgentCommand('test', {})
      ).rejects.toThrow('Browser not started');
    });
  });

  describe('navigateTo', () => {
    beforeEach(async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();
    });

    it('should navigate to full URL', async () => {
      await browserManager.navigateTo('http://example.com/page');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'http://example.com/page',
        { waitUntil: 'domcontentloaded' }
      );
    });

    it('should navigate to relative path', async () => {
      await browserManager.navigateTo('/courses/');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'http://localhost:8000/courses/',
        { waitUntil: 'domcontentloaded' }
      );
    });

    it('should wait for FixiPlug on new page', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);

      await browserManager.navigateTo('/page');

      expect(mockPage.waitForFunction).toHaveBeenCalledWith(
        "typeof window.fixiplug !== 'undefined'",
        { timeout: testConfig.browser.timeout.fixiplug }
      );
    });

    it('should handle pages without FixiPlug gracefully', async () => {
      mockPage.waitForFunction.mockRejectedValue(new Error('Timeout'));

      // Should not throw
      await expect(
        browserManager.navigateTo('/static-page')
      ).resolves.not.toThrow();
    });

    it('should throw if browser not started', async () => {
      const freshManager = new BrowserManager(testConfig);

      await expect(freshManager.navigateTo('/page')).rejects.toThrow(
        'Browser not started'
      );
    });
  });

  describe('getPageContent', () => {
    beforeEach(async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();
    });

    it('should return page content', async () => {
      mockPage.content.mockResolvedValue('<html>Test</html>');

      const content = await browserManager.getPageContent();

      expect(content).toBe('<html>Test</html>');
      expect(mockPage.content).toHaveBeenCalled();
    });

    it('should throw if browser not started', async () => {
      const freshManager = new BrowserManager(testConfig);

      await expect(freshManager.getPageContent()).rejects.toThrow(
        'Browser not started'
      );
    });
  });

  describe('getPage', () => {
    it('should return null if browser not started', () => {
      const page = browserManager.getPage();
      expect(page).toBeNull();
    });

    it('should return page if browser started', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();

      const page = browserManager.getPage();
      expect(page).toBe(mockPage);
    });
  });

  describe('isActive', () => {
    it('should return false initially', () => {
      expect(browserManager.isActive()).toBe(false);
    });

    it('should return true after start', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();

      expect(browserManager.isActive()).toBe(true);
    });

    it('should return false after close', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();
      await browserManager.close();

      expect(browserManager.isActive()).toBe(false);
    });
  });

  describe('close', () => {
    it('should close browser', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();

      await browserManager.close();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.isActive()).toBe(false);
    });

    it('should be safe to call when not started', async () => {
      await expect(browserManager.close()).resolves.not.toThrow();
    });

    it('should be safe to call multiple times', async () => {
      mockPage.waitForFunction.mockResolvedValue({} as any);
      await browserManager.start();

      await browserManager.close();
      await browserManager.close();

      expect(mockBrowser.close).toHaveBeenCalledTimes(1);
    });
  });
});
