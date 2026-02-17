# FixiPlug MCP Server - Examples

Real-world examples of using the FixiPlug MCP server tools.

## Table of Contents

- [Basic Queries](#basic-queries)
- [Data Extraction](#data-extraction)
- [Form Interaction](#form-interaction)
- [Navigation](#navigation)
- [Complex Workflows](#complex-workflows)
- [Error Handling](#error-handling)

## Basic Queries

### Search for Courses

```typescript
// Search for math courses
const result = await mcp.call_tool('query_courses', {
  filter: {
    search: 'mathematics'
  },
  limit: 10
});

if (result.success) {
  console.log(`Found ${result.data.pagination.total} courses`);
  result.data.data.forEach(course => {
    console.log(`- ${course.title} (${course.subject})`);
  });
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "title": "Calculus I",
        "subject": "Mathematics",
        "credits": 4
      },
      {
        "id": 2,
        "title": "Linear Algebra",
        "subject": "Mathematics",
        "credits": 3
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 15,
      "totalPages": 2
    }
  },
  "meta": {
    "timestamp": "2025-01-15T10:30:00.000Z",
    "executionTime": 45,
    "method": "direct-api"
  }
}
```

### Paginate Through Results

```typescript
// Get second page of results
const page2 = await mcp.call_tool('query_courses', {
  filter: {
    search: 'physics',
    page: 2
  },
  limit: 25
});

console.log(`Page ${page2.data.pagination.page} of ${page2.data.pagination.totalPages}`);
```

### Get All Courses

```typescript
// Get maximum allowed results
const allCourses = await mcp.call_tool('query_courses', {
  limit: 100
});

if (allCourses.success) {
  console.log(`Retrieved ${allCourses.data.data.length} courses`);
}
```

## Data Extraction

### Extract Table Data (Object Format)

Extract data using CSS selectors for precise control:

```typescript
const result = await mcp.call_tool('extract_data', {
  selector: 'tbody tr',
  fields: {
    id: 'td:nth-child(1)',
    name: 'td:nth-child(2)',
    email: 'td:nth-child(3)',
    role: 'td.role-column'
  }
});

if (result.success) {
  console.log(`Extracted ${result.count} rows`);
  result.data.forEach(row => {
    console.log(`${row.name} <${row.email}> - ${row.role}`);
  });
}
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {"id": "1", "name": "Alice", "email": "alice@example.com", "role": "Admin"},
    {"id": "2", "name": "Bob", "email": "bob@example.com", "role": "User"},
    {"id": "3", "name": "Carol", "email": "carol@example.com", "role": "User"}
  ],
  "selector": "tbody tr",
  "fieldsFormat": "object"
}
```

### Extract Data (Array Format)

Extract using data attributes:

```typescript
const products = await mcp.call_tool('extract_data', {
  selector: '.product-card',
  fields: ['name', 'price', 'stock']
});
```

This looks for:
- `[data-field="name"]`
- `[name="price"]`
- `[data-stock]` or `data-price`

### Extract Specific Elements

```typescript
// Extract only specific cards
const featured = await mcp.call_tool('extract_data', {
  selector: '.product-card.featured',
  fields: {
    title: 'h3.product-title',
    price: 'span.price',
    discount: 'span.discount',
    image: 'img',
  }
});

featured.data.forEach(product => {
  console.log(`${product.title}: ${product.price} (${product.discount} off)`);
});
```

## Form Interaction

### Fill a Contact Form

```typescript
// Navigate to the form page
await mcp.call_tool('navigate', {
  url: '/contact/'
});

// Fill the form
const fillResult = await mcp.call_tool('fill_form', {
  form_selector: '#contact-form',
  data: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Inquiry',
    message: 'I have a question about your services.'
  }
});

if (fillResult.success) {
  console.log(`Filled fields: ${fillResult.data.filled.join(', ')}`);

  // Submit the form
  await mcp.call_tool('click_button', {
    text: 'Send Message'
  });
}
```

### Fill a Registration Form

```typescript
const registration = await mcp.call_tool('fill_form', {
  form_selector: '#signup-form',
  data: {
    username: 'newuser123',
    email: 'newuser@example.com',
    password: 'SecurePass123!',
    age: 25,
    terms: true,  // Checkbox
    newsletter: false,  // Checkbox
    country: 'US',  // Select dropdown
    gender: 'female'  // Radio button
  }
});

if (!registration.success) {
  console.error('Form fill failed:', registration.error);
  if (registration.data.errors) {
    registration.data.errors.forEach(err => {
      console.error(`- ${err.field}: ${err.error}`);
    });
  }
}
```

### Update Form and Submit

```typescript
// Fill and submit in one workflow
await mcp.call_tool('navigate', { url: '/profile/edit/' });

const update = await mcp.call_tool('fill_form', {
  form_selector: '#profile-form',
  data: {
    bio: 'Updated bio text',
    location: 'San Francisco, CA'
  }
});

if (update.success) {
  // Click save button
  await mcp.call_tool('click_button', {
    selector: 'button[type="submit"]'
  });

  console.log('Profile updated successfully');
}
```

## Navigation

### Navigate to Different Pages

```typescript
// Navigate to courses page
await mcp.call_tool('navigate', {
  url: '/experimental/courses/'
});

// Navigate to a specific course
await mcp.call_tool('navigate', {
  url: '/courses/123/'
});

// Navigate to external URL
await mcp.call_tool('navigate', {
  url: 'http://example.com/page'
});
```

### Sequential Navigation

```typescript
// Visit multiple pages
const pages = [
  '/dashboard/',
  '/courses/',
  '/students/',
  '/reports/'
];

for (const page of pages) {
  const result = await mcp.call_tool('navigate', { url: page });
  console.log(result.data.message);

  // Extract some data from each page
  const data = await mcp.call_tool('get_table_data', {});
  console.log(`Found ${data.data?.data?.length || 0} items`);
}
```

## Complex Workflows

### Search, Extract, and Process

Complete workflow to search for data and process it:

```typescript
async function findAndProcessCourses(searchTerm: string) {
  // 1. Navigate to courses page
  await mcp.call_tool('navigate', {
    url: '/experimental/courses/'
  });

  // 2. Search for courses
  const searchResults = await mcp.call_tool('query_courses', {
    filter: { search: searchTerm },
    limit: 50
  });

  if (!searchResults.success) {
    throw new Error(`Search failed: ${searchResults.error}`);
  }

  // 3. Process results
  const courses = searchResults.data.data;
  const highCreditCourses = courses.filter(c => c.credits >= 4);

  console.log(`Found ${courses.length} courses matching "${searchTerm}"`);
  console.log(`${highCreditCourses.length} are 4+ credit courses`);

  // 4. Extract additional details from the page
  const details = await mcp.call_tool('extract_data', {
    selector: 'tr[data-course-id]',
    fields: {
      id: 'td:nth-child(1)',
      instructor: 'td.instructor',
      schedule: 'td.schedule',
      enrollment: 'td.enrollment'
    }
  });

  // 5. Combine data
  return courses.map((course, idx) => ({
    ...course,
    ...details.data[idx]
  }));
}

// Usage
const mathCourses = await findAndProcessCourses('mathematics');
```

### Bulk Form Submission

```typescript
async function createMultipleStudents(students: Array<{name: string, email: string}>) {
  const results = [];

  for (const student of students) {
    // Navigate to form
    await mcp.call_tool('navigate', {
      url: '/students/new/'
    });

    // Fill form
    const fillResult = await mcp.call_tool('fill_form', {
      form_selector: '#student-form',
      data: student
    });

    if (fillResult.success) {
      // Submit
      await mcp.call_tool('click_button', {
        text: 'Create Student'
      });

      results.push({ ...student, status: 'created' });
    } else {
      results.push({ ...student, status: 'failed', error: fillResult.error });
    }

    // Small delay between submissions
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
```

### Data Validation Workflow

```typescript
async function validateAndSubmit(formData: any) {
  // 1. Navigate to form
  await mcp.call_tool('navigate', { url: '/data-entry/' });

  // 2. Fill form
  const fillResult = await mcp.call_tool('fill_form', {
    form_selector: '#data-form',
    data: formData
  });

  if (!fillResult.success) {
    return { success: false, errors: fillResult.data.errors };
  }

  // 3. Click validate button (don't submit yet)
  await mcp.call_tool('click_button', {
    text: 'Validate'
  });

  // 4. Wait a bit for validation
  await new Promise(resolve => setTimeout(resolve, 500));

  // 5. Check for validation errors on page
  const errors = await mcp.call_tool('extract_data', {
    selector: '.validation-error',
    fields: {
      field: '.error-field',
      message: '.error-message'
    }
  });

  if (errors.count > 0) {
    return { success: false, validationErrors: errors.data };
  }

  // 6. No errors, submit the form
  await mcp.call_tool('click_button', {
    text: 'Submit'
  });

  return { success: true };
}
```

## Error Handling

### Graceful Degradation

```typescript
async function getCoursesWithFallback(search: string) {
  try {
    // Try direct query first
    const result = await mcp.call_tool('query_courses', {
      filter: { search },
      limit: 25
    });

    if (result.success) {
      return result.data.data;
    }

    // If that fails, try navigating and extracting
    console.warn('Direct query failed, trying extraction');
    await mcp.call_tool('navigate', {
      url: `/courses/?q=${encodeURIComponent(search)}`
    });

    const extracted = await mcp.call_tool('extract_data', {
      selector: '.course-row',
      fields: {
        id: '[data-course-id]',
        title: '.course-title',
        subject: '.course-subject'
      }
    });

    return extracted.data;

  } catch (error) {
    console.error('All methods failed:', error);
    return [];
  }
}
```

### Retry Logic

```typescript
async function retryTool<T>(
  toolName: string,
  params: any,
  maxRetries = 3
): Promise<T> {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await mcp.call_tool(toolName, params);

      if (result.success) {
        return result.data;
      }

      lastError = result.error;
      console.warn(`Attempt ${i + 1} failed: ${result.error}`);

    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${i + 1} threw error:`, error);
    }

    // Exponential backoff
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }

  throw new Error(`Failed after ${maxRetries} attempts: ${lastError}`);
}

// Usage
const courses = await retryTool('query_courses', { limit: 10 }, 3);
```

### Validation Before Action

```typescript
async function safeFormFill(formSelector: string, data: any) {
  // Navigate first
  const navResult = await mcp.call_tool('navigate', {
    url: '/form-page/'
  });

  if (!navResult.success) {
    return { success: false, error: 'Navigation failed', details: navResult.error };
  }

  // Verify form exists by trying to extract it
  const formCheck = await mcp.call_tool('extract_data', {
    selector: formSelector,
    fields: {}
  });

  if (formCheck.count === 0) {
    return { success: false, error: 'Form not found on page' };
  }

  // Now fill
  const fillResult = await mcp.call_tool('fill_form', {
    form_selector: formSelector,
    data
  });

  if (!fillResult.success) {
    return fillResult;
  }

  // Check for visible errors before submitting
  const visibleErrors = await mcp.call_tool('extract_data', {
    selector: '.error-message:visible',
    fields: { message: '' }
  });

  if (visibleErrors.count > 0) {
    return {
      success: false,
      error: 'Validation errors present',
      errors: visibleErrors.data
    };
  }

  return fillResult;
}
```

## Testing Examples

### Unit Test Pattern

```typescript
describe('Course Search', () => {
  it('should find courses by search term', async () => {
    const result = await mcp.call_tool('query_courses', {
      filter: { search: 'physics' },
      limit: 10
    });

    expect(result.success).toBe(true);
    expect(result.data.data).toBeInstanceOf(Array);
    expect(result.data.data.length).toBeGreaterThan(0);
    expect(result.data.data[0]).toHaveProperty('title');
    expect(result.meta.executionTime).toBeLessThan(5000);
  });
});
```

### Integration Test Pattern

```typescript
describe('Complete User Flow', () => {
  it('should create a student and enroll in course', async () => {
    // Navigate to student creation
    await mcp.call_tool('navigate', { url: '/students/new/' });

    // Fill student form
    const student = await mcp.call_tool('fill_form', {
      form_selector: '#student-form',
      data: {
        name: 'Test Student',
        email: 'test@example.com'
      }
    });

    expect(student.success).toBe(true);

    // Submit
    await mcp.call_tool('click_button', { text: 'Create' });

    // Verify student was created
    const students = await mcp.call_tool('query_courses', {
      filter: { search: 'Test Student' }
    });

    expect(students.data.data.length).toBeGreaterThan(0);
  });
});
```

## Best Practices

1. **Always check `success` before using data**
2. **Use appropriate timeouts for slow operations**
3. **Implement retry logic for unreliable operations**
4. **Extract and validate before submitting forms**
5. **Use direct API (`query_courses`) when possible for better performance**
6. **Handle errors gracefully with fallbacks**
7. **Log execution times to identify bottlenecks**
8. **Test with real data in development environment first**

## More Examples

For more examples, see:
- [MCP Integration Tests](../../../dj-fixi/tests/test_mcp_integration.py)
- [Validation Document](../../MCP_SERVER_VALIDATION.md)
- [Agent Commands Plugin](../../plugins/agent-commands.js)
