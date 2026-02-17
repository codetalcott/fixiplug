/**
 * Test file for Table Plugin
 * Tests core rendering, Django integration, sorting, and inline editing
 */

import fixiplug from './fixiplug.js';
import createDataPipeline from './plugins/data-pipeline.js';
import createTablePlugin from './plugins/table.js';
import createDjangoIntegration from './plugins/django-integration.js';

// Test data
const sampleData = [
  { id: 1, name: 'Alice Johnson', age: 30, email: 'alice@example.com', active: true },
  { id: 2, name: 'Bob Smith', age: 25, email: 'bob@example.com', active: false },
  { id: 3, name: 'Charlie Brown', age: 35, email: 'charlie@example.com', active: true },
  { id: 4, name: 'Diana Prince', age: 28, email: 'diana@example.com', active: true },
  { id: 5, name: 'Eve Davis', age: 32, email: 'eve@example.com', active: false }
];

// Django format data (simulating dj-fixi response)
const djangoData = {
  data: [
    { id: 1, name: 'Product A', price: 29.99, stock: 100 },
    { id: 2, name: 'Product B', price: 49.99, stock: 50 },
    { id: 3, name: 'Product C', price: 19.99, stock: 200 }
  ],
  columns: [
    { key: 'id', label: 'ID', sortable: true, editable: false },
    { key: 'name', label: 'Product Name', sortable: true, editable: true, inputType: 'text' },
    { key: 'price', label: 'Price', sortable: true, editable: true, inputType: 'number', type: 'number' },
    { key: 'stock', label: 'Stock', sortable: true, editable: true, inputType: 'number' }
  ],
  meta: {
    editable: true,
    sortable: true,
    searchable: false
  }
};

// Initialize fixiplug with plugins
fixiplug.use(createDataPipeline());
fixiplug.use(createDjangoIntegration());
fixiplug.use(createTablePlugin());

console.log('=== Table Plugin Test Suite ===\n');

// Test counter
let testsPassed = 0;
let testsFailed = 0;
const testOutput = [];

function log(message, type = 'info') {
  const formatted = message;
  console.log(formatted);
  testOutput.push({ message: formatted, type });
  updateOutput();
}

function assert(condition, message) {
  if (condition) {
    const msg = '✅ PASS: ' + message;
    console.log(msg);
    testOutput.push({ message: msg, type: 'pass' });
    testsPassed++;
  } else {
    const msg = '❌ FAIL: ' + message;
    console.error(msg);
    testOutput.push({ message: msg, type: 'fail' });
    testsFailed++;
  }
  updateOutput();
}

function updateOutput() {
  const outputDiv = document.getElementById('test-output');
  if (outputDiv) {
    outputDiv.innerHTML = testOutput.map(item => {
      const className = item.type === 'pass' ? 'pass' : item.type === 'fail' ? 'fail' : '';
      return `<div class="${className}">${item.message}</div>`;
    }).join('');
  }
}

function createTestContainer(id) {
  const container = document.createElement('div');
  container.id = id;
  const testContainers = document.getElementById('test-containers') || document.body;
  testContainers.appendChild(container);
  return container;
}

async function runTests() {
  // Test 1: Basic table rendering
  log('\n--- Test 1: Basic Table Rendering ---');
  const table1 = createTestContainer('test-table-1');
  table1.setAttribute('fx-table', '');

  // Simulate fx:data event
  await fixiplug.dispatch('fx:data', {
    target: table1,
    detail: {
      data: sampleData,
      cfg: {}
    }
  });

  // Wait for rendering
  await new Promise(resolve => setTimeout(resolve, 100));

  const renderedTable = table1.querySelector('table.fx-table');
  assert(renderedTable !== null, 'Table element should be rendered');
  assert(renderedTable.querySelectorAll('thead th').length === 5, 'Should have 5 columns (id, name, age, email, active)');
  assert(renderedTable.querySelectorAll('tbody tr').length === 5, 'Should have 5 data rows');

  const firstCell = renderedTable.querySelector('tbody tr:first-child td:nth-child(2)');
  assert(firstCell && firstCell.textContent.includes('Alice'), 'First row should contain Alice');

  // Test 2: Django format detection
  log('\n--- Test 2: Django Format Detection ---');
  const table2 = createTestContainer('test-table-2');
  table2.setAttribute('fx-table', '');

  // Simulate Django data event
  await fixiplug.dispatch('fx:data', {
    target: table2,
    detail: {
      data: djangoData,
      djangoTable: true,
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const djangoTable = table2.querySelector('table.fx-table');
  assert(djangoTable !== null, 'Django table should be rendered');
  assert(table2.dataset.djangoTable === 'true', 'Django table flag should be set');
  assert(table2.hasAttribute('fx-table-editable'), 'Should auto-enable editable based on Django meta');
  assert(table2.hasAttribute('fx-table-sortable'), 'Should auto-enable sortable based on Django meta');

  const djangoCols = djangoTable.querySelectorAll('thead th');
  assert(djangoCols.length === 4, 'Django table should have 4 columns');
  assert(djangoCols[1].textContent.includes('Product Name'), 'Should use Django column labels');

  // Test 3: Column sorting
  log('\n--- Test 3: Column Sorting ---');
  const table3 = createTestContainer('test-table-3');
  table3.setAttribute('fx-table', '');
  table3.setAttribute('fx-table-sortable', '');

  await fixiplug.dispatch('fx:data', {
    target: table3,
    detail: {
      data: sampleData,
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const sortableTable = table3.querySelector('table.fx-table');
  const ageHeader = sortableTable.querySelector('th[data-column="age"]');

  assert(ageHeader.classList.contains('fx-sortable'), 'Age column should be sortable');
  assert(ageHeader.textContent.includes('⇅'), 'Should show sort icon');

  // Simulate click on age header to sort
  ageHeader.click();
  await new Promise(resolve => setTimeout(resolve, 100));

  const sortedTable = table3.querySelector('table.fx-table');
  const firstAge = sortedTable.querySelector('tbody tr:first-child td:nth-child(3)');
  assert(firstAge && firstAge.textContent === '25', 'After sorting, youngest person (Bob, 25) should be first');

  // Click again to sort descending
  const ageHeaderAfter = sortedTable.querySelector('th[data-column="age"]');
  ageHeaderAfter.click();
  await new Promise(resolve => setTimeout(resolve, 100));

  const sortedTableDesc = table3.querySelector('table.fx-table');
  const firstAgeDesc = sortedTableDesc.querySelector('tbody tr:first-child td:nth-child(3)');
  assert(firstAgeDesc && firstAgeDesc.textContent === '35', 'After descending sort, oldest person (Charlie, 35) should be first');

  // Test 4: Editable cells
  log('\n--- Test 4: Editable Cells ---');
  const table4 = createTestContainer('test-table-4');
  table4.setAttribute('fx-table', '');
  table4.setAttribute('fx-table-editable', '');
  table4.setAttribute('fx-table-columns', JSON.stringify([
    { key: 'id', label: 'ID', editable: false },
    { key: 'name', label: 'Name', editable: true, inputType: 'text' },
    { key: 'age', label: 'Age', editable: true, inputType: 'number' }
  ]));

  await fixiplug.dispatch('fx:data', {
    target: table4,
    detail: {
      data: sampleData.slice(0, 2), // Just 2 rows for this test
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const editableTable = table4.querySelector('table.fx-table');
  const editableCells = editableTable.querySelectorAll('.fx-editable');
  assert(editableCells.length === 4, 'Should have 4 editable cells (name and age for 2 rows)');

  const nameCell = editableTable.querySelector('tbody tr:first-child td[data-column="name"]');
  assert(nameCell.classList.contains('fx-editable'), 'Name cell should be editable');
  assert(nameCell.getAttribute('tabindex') === '0', 'Editable cell should be focusable');

  const idCell = editableTable.querySelector('tbody tr:first-child td[data-column="id"]');
  assert(!idCell.classList.contains('fx-editable'), 'ID cell should not be editable');

  // Test 5: Data type formatting
  log('\n--- Test 5: Data Type Formatting ---');
  const table5 = createTestContainer('test-table-5');
  table5.setAttribute('fx-table', '');

  await fixiplug.dispatch('fx:data', {
    target: table5,
    detail: {
      data: sampleData,
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const formattedTable = table5.querySelector('table.fx-table');
  const booleanCell = formattedTable.querySelector('tbody tr:first-child td:nth-child(5)');
  assert(booleanCell && (booleanCell.textContent === '✓' || booleanCell.textContent === '✗'),
    'Boolean values should be formatted with checkmarks');

  // Test 6: Empty data handling
  log('\n--- Test 6: Empty Data Handling ---');
  const table6 = createTestContainer('test-table-6');
  table6.setAttribute('fx-table', '');

  await fixiplug.dispatch('fx:data', {
    target: table6,
    detail: {
      data: [],
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const emptyTable = table6.querySelector('table.fx-table');
  assert(emptyTable === null || emptyTable.querySelectorAll('tbody tr').length === 0,
    'Empty data should render table with no rows or no table');

  // Test 7: Custom column configuration
  log('\n--- Test 7: Custom Column Configuration ---');
  const table7 = createTestContainer('test-table-7');
  table7.setAttribute('fx-table', '');
  table7.setAttribute('fx-table-columns', JSON.stringify([
    { key: 'name', label: 'Full Name', type: 'string' },
    { key: 'email', label: 'Email Address', type: 'string' }
  ]));

  await fixiplug.dispatch('fx:data', {
    target: table7,
    detail: {
      data: sampleData,
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const customTable = table7.querySelector('table.fx-table');
  const customHeaders = customTable.querySelectorAll('thead th');
  assert(customHeaders.length === 2, 'Should only show 2 columns based on custom config');
  assert(customHeaders[0].textContent.includes('Full Name'), 'Should use custom column label');
  assert(customHeaders[1].textContent.includes('Email Address'), 'Should use custom column label');

  // Test 8: Striped rows
  log('\n--- Test 8: Striped Rows ---');
  const table8 = createTestContainer('test-table-8');
  table8.setAttribute('fx-table', '');

  await fixiplug.dispatch('fx:data', {
    target: table8,
    detail: {
      data: sampleData,
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const stripedTable = table8.querySelector('table.fx-table');
  const stripedRows = stripedTable.querySelectorAll('tbody tr.fx-table-striped');
  assert(stripedRows.length > 0, 'Should have striped rows for odd indices');

  // Test 9: Sort state preservation
  log('\n--- Test 9: Sort State Preservation ---');
  const table9 = createTestContainer('test-table-9');
  table9.setAttribute('fx-table', '');
  table9.setAttribute('fx-table-sortable', '');
  table9.setAttribute('fx-sort-column', 'name');
  table9.setAttribute('fx-sort-dir', 'asc');

  await fixiplug.dispatch('fx:data', {
    target: table9,
    detail: {
      data: sampleData,
      cfg: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 100));

  const presortedTable = table9.querySelector('table.fx-table');
  const nameHeader = presortedTable.querySelector('th[data-column="name"]');
  assert(nameHeader.classList.contains('fx-sorted-asc'), 'Name column should show as sorted ascending');
  assert(nameHeader.textContent.includes('▲'), 'Should show ascending sort indicator');

  // Print summary
  log('\n=== Test Summary ===');
  log(`Total tests: ${testsPassed + testsFailed}`);
  log(`✅ Passed: ${testsPassed}`);
  log(`❌ Failed: ${testsFailed}`);

  const summaryDiv = document.getElementById('test-summary');
  if (summaryDiv) {
    summaryDiv.innerHTML = `
      <strong>Test Summary:</strong><br>
      Total: ${testsPassed + testsFailed}<br>
      <span class="pass">✅ Passed: ${testsPassed}</span><br>
      <span class="fail">❌ Failed: ${testsFailed}</span><br><br>
      ${testsFailed === 0 ? '<span class="pass">🎉 All tests passed!</span>' : `<span class="fail">⚠️ ${testsFailed} test(s) failed</span>`}
    `;
  }

  if (testsFailed === 0) {
    log('\n🎉 All tests passed!');
  } else {
    log(`\n⚠️  ${testsFailed} test(s) failed`);
  }
}

// Run tests when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runTests);
} else {
  runTests();
}
