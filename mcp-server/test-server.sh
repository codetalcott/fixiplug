#!/bin/bash

# Simple test to verify the MCP server starts correctly
# This sends a basic MCP initialization request

echo "Testing FixiPlug MCP Server..."
echo ""
echo "Sending initialization request..."
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node build/index.js

echo ""
echo "If you see a response above, the server is working!"
echo "Press Ctrl+C to exit"
