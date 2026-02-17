/**
 * Direct test of MCP server tools
 * This simulates what Claude Code would do when calling the tools
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';

// Start the MCP server
const server = spawn('node', ['build/index.js'], {
  cwd: '/Users/williamtalcott/projects/fixiplug/mcp-server',
  env: {
    ...process.env,
    DJANGO_BASE_URL: 'http://localhost:8000',
    HEADLESS: 'true',
    AUTO_START_BROWSER: 'false' // Don't auto-start for testing
  }
});

let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();

  // Try to parse complete JSON-RPC messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer

  lines.forEach(line => {
    if (line.trim()) {
      try {
        const message = JSON.parse(line);
        console.log('Server response:', JSON.stringify(message, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server log:', data.toString());
});

// Send initialization
const init = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

console.log('Sending init:', JSON.stringify(init));
server.stdin.write(JSON.stringify(init) + '\n');

// After 2 seconds, list tools
setTimeout(() => {
  const listTools = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };

  console.log('\nSending list tools:', JSON.stringify(listTools));
  server.stdin.write(JSON.stringify(listTools) + '\n');
}, 2000);

// After 4 seconds, exit
setTimeout(() => {
  server.kill();
  process.exit(0);
}, 4000);
