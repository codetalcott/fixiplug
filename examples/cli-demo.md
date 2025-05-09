## Using the Fixiplug CLI

The Fixiplug CLI provides commands to quickly set up different environments for your projects.

### Help Command

Running the CLI with the `help` command or no command shows available options:

```
$ npx fixiplug help

Fixiplug CLI

Commands:
  init:browser   Setup browser environment with DOM integration
  init:test      Setup test environment with enhanced debugging
  init:server    Setup server environment optimized for Node.js
```

### Browser Environment Setup

Setting up a browser environment creates HTML, JavaScript, and plugin files optimized for browser usage:

```
$ npx fixiplug init:browser

Setting up browser environment...
Created directory: plugins
Created file: index.html
Created file: app.js
Created file: plugins/my-plugin.js
Created package.json

Browser environment setup complete!

To start the application:
1. Install dependencies: npm install
2. Start the server: npm start
3. Open http://localhost:5000 in your browser
```

This creates:

- An `index.html` file with Fixiplug integration
- An `app.js` entry point
- A sample plugin
- Appropriate package.json configuration

### Test Environment Setup

For testing, use the `init:test` command:

```
$ npx fixiplug init:test

Setting up test environment...
Created directory: test
Created directory: plugins
Created file: test-config.js
Created file: test/plugin.test.js
Created file: plugins/my-plugin.js
Created file: .babelrc
Created package.json

Test environment setup complete!

To run the tests:
1. Install dependencies: npm install
2. Run tests: npm test
```

This creates a test environment with:

- Jest configuration
- Sample test file
- Test-specific configuration for Fixiplug

### Server Environment Setup

For server-side applications:

```
$ npx fixiplug init:server

Setting up server environment...
Created directory: plugins
Created file: server.js
Created file: plugins/logger-plugin.js
Created file: plugins/api-plugin.js
Created package.json

Server environment setup complete!

To start the server:
1. Install dependencies: npm install
2. Start the server: npm start
```

This creates a Node.js application with:

- A server.js file using the server-optimized version of Fixiplug
- Sample plugins for logging and API functionality
