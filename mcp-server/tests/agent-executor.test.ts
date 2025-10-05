/**
 * Unit tests for AgentExecutor
 */

import { AgentExecutor } from '../src/agent-executor.js';
import { BrowserManager } from '../src/browser.js';
import { Config, defaultConfig } from '../src/core/types.js';

// Mock BrowserManager
jest.mock('../src/browser.js');

describe('AgentExecutor', () => {
  let executor: AgentExecutor;
  let mockBrowser: jest.Mocked<BrowserManager>;
  let testConfig: Config;

  beforeEach(() => {
    // Create mock browser
    mockBrowser = {
      isActive: jest.fn(),
      navigateTo: jest.fn(),
      getPage: jest.fn(),
      executeAgentCommand: jest.fn(),
      start: jest.fn(),
      close: jest.fn(),
      getPageContent: jest.fn(),
    } as any;

    testConfig = {
      ...defaultConfig,
      baseUrl: 'http://localhost:8000',
    };

    executor = new AgentExecutor(mockBrowser, testConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryCourses', () => {
    it('should return success response with data', async () => {
      const mockData = {
        data: [{ id: 1, name: 'Math 101' }],
        pagination: { page: 1, total: 1 },
      };

      // Mock successful fetch
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await executor.queryCourses({
        filter: { search: 'math' },
        limit: 25,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockData);
      expect(result.meta?.method).toBe('direct-api');
      expect(result.meta?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include search query in URL', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await executor.queryCourses({
        filter: { search: 'physics' },
        limit: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('q=physics'),
        expect.any(Object)
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      mockBrowser.isActive.mockReturnValue(false);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const result = await executor.queryCourses({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fallback to browser when direct API fails', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.getPage.mockReturnValue({
        evaluate: jest.fn().mockResolvedValue({ data: [] }),
      } as any);

      // Fail direct API
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await executor.queryCourses({});

      expect(result.success).toBe(true);
      expect(result.meta?.method).toBe('browser-fallback');
      expect(mockBrowser.navigateTo).toHaveBeenCalled();
    });

    it('should handle pagination parameters', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);

      await executor.queryCourses({
        filter: { page: 3 },
        limit: 50,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('page=3'),
        expect.any(Object)
      );
    });
  });

  describe('clickButton', () => {
    it('should return error if browser not active', async () => {
      mockBrowser.isActive.mockReturnValue(false);

      const result = await executor.clickButton({
        selector: '#btn',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should execute click command with selector', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.executeAgentCommand.mockResolvedValue({
        success: true,
        clicked: 'Submit',
      });

      const result = await executor.clickButton({
        selector: '#submit-btn',
      });

      expect(result.success).toBe(true);
      expect(mockBrowser.executeAgentCommand).toHaveBeenCalledWith(
        'agent:clickButton',
        { selector: '#submit-btn' }
      );
    });

    it('should execute click command with text', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.executeAgentCommand.mockResolvedValue({
        success: true,
      });

      await executor.clickButton({
        text: 'Submit',
      });

      expect(mockBrowser.executeAgentCommand).toHaveBeenCalledWith(
        'agent:clickButton',
        { button: 'Submit' }
      );
    });

    it('should require selector or text', async () => {
      mockBrowser.isActive.mockReturnValue(true);

      const result = await executor.clickButton({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Must provide selector or text');
    });
  });

  describe('extractData', () => {
    it('should return error if browser not active', async () => {
      mockBrowser.isActive.mockReturnValue(false);

      const result = await executor.extractData({
        selector: '.item',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should execute extract command', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.executeAgentCommand.mockResolvedValue({
        data: [{ id: 1, name: 'Item' }],
      });

      const result = await executor.extractData({
        selector: '.item',
        fields: { name: '.name' },
      });

      expect(result.success).toBe(true);
      expect(mockBrowser.executeAgentCommand).toHaveBeenCalledWith(
        'agent:extract',
        {
          selector: '.item',
          fields: { name: '.name' },
        }
      );
    });
  });

  describe('fillForm', () => {
    it('should return error if browser not active', async () => {
      mockBrowser.isActive.mockReturnValue(false);

      const result = await executor.fillForm({
        form_selector: '#form',
        data: { name: 'Test' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should execute fillForm command', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.executeAgentCommand.mockResolvedValue({
        success: true,
        filled: ['name', 'email'],
      });

      const result = await executor.fillForm({
        form_selector: '#contact-form',
        data: { name: 'John', email: 'john@example.com' },
      });

      expect(result.success).toBe(true);
      expect(mockBrowser.executeAgentCommand).toHaveBeenCalledWith(
        'agent:fillForm',
        {
          form: '#contact-form',
          data: { name: 'John', email: 'john@example.com' },
        }
      );
    });
  });

  describe('navigate', () => {
    it('should return error if browser not active', async () => {
      mockBrowser.isActive.mockReturnValue(false);

      const result = await executor.navigate({
        url: '/page',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should navigate to URL', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.navigateTo.mockResolvedValue(undefined);

      const result = await executor.navigate({
        url: '/experimental/courses/',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        message: 'Navigated to /experimental/courses/',
      });
      expect(mockBrowser.navigateTo).toHaveBeenCalledWith(
        '/experimental/courses/'
      );
    });
  });

  describe('getTableData', () => {
    it('should return error if browser not active', async () => {
      mockBrowser.isActive.mockReturnValue(false);

      const result = await executor.getTableData({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should use default table selector', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.executeAgentCommand.mockResolvedValue({
        data: [],
      });

      const result = await executor.getTableData({});

      expect(result.success).toBe(true);
      expect(mockBrowser.executeAgentCommand).toHaveBeenCalledWith(
        'agent:queryTable',
        {
          table: '#course-table',
          extractData: true,
        }
      );
    });

    it('should use custom table selector', async () => {
      mockBrowser.isActive.mockReturnValue(true);
      mockBrowser.executeAgentCommand.mockResolvedValue({
        data: [],
      });

      await executor.getTableData({
        table_selector: '#products',
      });

      expect(mockBrowser.executeAgentCommand).toHaveBeenCalledWith(
        'agent:queryTable',
        {
          table: '#products',
          extractData: true,
        }
      );
    });
  });

  describe('Error handling', () => {
    it('should track execution time in errors', async () => {
      mockBrowser.isActive.mockReturnValue(false);

      const result = await executor.clickButton({
        selector: '#btn',
      });

      expect(result.success).toBe(false);
      expect(result.meta?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include original args in error metadata', async () => {
      mockBrowser.isActive.mockReturnValue(false);
      const args = { selector: '#test' };

      const result = await executor.clickButton(args);

      expect(result.success).toBe(false);
      expect(result.meta?.args).toEqual(args);
    });
  });
});
