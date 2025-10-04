/**
 * Tool definitions for the FixiPlug MCP server
 */

import { z } from "zod";

export const toolSchemas = {
  query_courses: z.object({
    filter: z.object({
      search: z.string().optional().describe("Search query (matches course title, subject, student name)"),
      page: z.number().int().positive().optional().describe("Page number (default: 1)")
    }).optional().describe("Filter criteria"),
    limit: z.number().int().min(1).max(100).default(25).describe("Number of results per page")
  }),

  click_button: z.object({
    selector: z.string().optional().describe("CSS selector for the button"),
    text: z.string().optional().describe("Button text to search for")
  }).refine(data => data.selector || data.text, {
    message: "Must provide either selector or text"
  }),

  extract_data: z.object({
    selector: z.string().describe("CSS selector for container elements"),
    fields: z.record(z.string()).optional().describe("Field mapping (field_name -> selector)")
  }),

  fill_form: z.object({
    form_selector: z.string().describe("CSS selector for form element"),
    data: z.record(z.any()).describe("Field values (field_name -> value)")
  }),

  navigate: z.object({
    url: z.string().describe("URL path to navigate to (e.g., '/experimental/courses/')")
  }),

  get_table_data: z.object({
    table_selector: z.string().default("#course-table").describe("CSS selector for table element")
  })
};

export const toolDescriptions = {
  query_courses: "Query course data from the Django database. Supports search, filtering, and pagination. Returns structured JSON with course information.",
  click_button: "Click a button on the page using FixiPlug agent command. Can target by text content or CSS selector.",
  extract_data: "Extract structured data from page elements using CSS selectors. Returns array of objects with extracted field values.",
  fill_form: "Fill form fields programmatically using FixiPlug agent command. Supports text inputs, selects, checkboxes, and radio buttons.",
  navigate: "Navigate to a URL in the browser. Waits for page load before returning.",
  get_table_data: "Extract all data from a table on the page. Returns structured array of row objects."
};
