/**
 * Unit tests for tool schemas and descriptions
 */

import { toolSchemas, toolDescriptions } from '../src/tools.js';
import { z } from 'zod';

describe('Tool Schemas', () => {
  describe('query_courses', () => {
    const schema = toolSchemas.query_courses;

    it('should accept valid input with all fields', () => {
      const input = {
        filter: {
          search: 'math',
          page: 2,
        },
        limit: 50,
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept empty filter', () => {
      const input = {
        filter: {},
        limit: 25,
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should use default limit', () => {
      const input = {};
      const result = schema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
      }
    });

    it('should reject negative page numbers', () => {
      const input = {
        filter: { page: -1 },
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const input = {
        limit: 150,
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject limit < 1', () => {
      const input = {
        limit: 0,
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('click_button', () => {
    const schema = toolSchemas.click_button;

    it('should accept selector only', () => {
      const input = {
        selector: '#submit-btn',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept text only', () => {
      const input = {
        text: 'Submit',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept both selector and text', () => {
      const input = {
        selector: '#btn',
        text: 'Click me',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject when neither selector nor text is provided', () => {
      const input = {};

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('extract_data', () => {
    const schema = toolSchemas.extract_data;

    it('should accept selector with array fields', () => {
      const input = {
        selector: '.product',
        fields: {
          name: 'h3',
          price: '.price',
        },
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept selector without fields', () => {
      const input = {
        selector: '.item',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject without selector', () => {
      const input = {
        fields: { name: '.name' },
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('fill_form', () => {
    const schema = toolSchemas.fill_form;

    it('should accept valid form data', () => {
      const input = {
        form_selector: '#contact-form',
        data: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
        },
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject without form_selector', () => {
      const input = {
        data: { field: 'value' },
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject without data', () => {
      const input = {
        form_selector: '#form',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('navigate', () => {
    const schema = toolSchemas.navigate;

    it('should accept valid URL', () => {
      const input = {
        url: '/experimental/courses/',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept full URL', () => {
      const input = {
        url: 'http://localhost:8000/page',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject without url', () => {
      const input = {};

      const result = schema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('get_table_data', () => {
    const schema = toolSchemas.get_table_data;

    it('should use default table selector', () => {
      const input = {};
      const result = schema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.table_selector).toBe('#course-table');
      }
    });

    it('should accept custom table selector', () => {
      const input = {
        table_selector: '#products-table',
      };

      const result = schema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.table_selector).toBe('#products-table');
      }
    });
  });
});

describe('Tool Descriptions', () => {
  it('should have descriptions for all schemas', () => {
    const schemaKeys = Object.keys(toolSchemas);
    const descriptionKeys = Object.keys(toolDescriptions);

    expect(schemaKeys.sort()).toEqual(descriptionKeys.sort());
  });

  it('should have non-empty descriptions', () => {
    Object.entries(toolDescriptions).forEach(([key, description]) => {
      expect(description).toBeTruthy();
      expect(description.length).toBeGreaterThan(10);
    });
  });

  it('descriptions should be informative', () => {
    // Each description should mention what the tool does
    expect(toolDescriptions.query_courses).toContain('course');
    expect(toolDescriptions.click_button).toContain('button');
    expect(toolDescriptions.extract_data).toContain('data');
    expect(toolDescriptions.fill_form).toContain('form');
    expect(toolDescriptions.navigate.toLowerCase()).toContain('navigate');
    expect(toolDescriptions.get_table_data).toContain('table');
  });
});
