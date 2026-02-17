/**
 * SQLite Extension Generator Plugin
 *
 * Enables LLM agents to generate optimized SQLite extensions in C, Rust, or Mojo.
 * Integrates with SQLite Extensions Framework for code generation capabilities.
 *
 * @module plugins/sqlite-extension-generator
 */

export default {
  name: 'sqliteExtensionGenerator',

  skill: {
    name: 'sqlite-extension-generator',
    description: 'Generate optimized SQLite extensions in C, Rust, or Mojo',
    instructions: `# SQLite Extension Generator

## Purpose

This skill enables you to generate high-performance SQLite extensions automatically from natural language descriptions. It analyzes requirements, recommends optimal implementation approaches, and generates production-ready code with tests.

## When to Use

Use this skill when you need to:
- Generate SQLite extensions from requirements
- Choose optimal backend language (C, Rust, Mojo)
- Analyze implementation complexity and trade-offs
- Get production-ready code with comprehensive tests
- Optimize for specific performance characteristics

## Available Hooks

### sqlite.extension.analyze

Analyze requirements and recommend implementation approach.

**Parameters:**
- \`description\` (string, required): What the extension should do
- \`domain\` (string, optional): Domain area (e.g., 'finance', 'analytics')
- \`performanceRequirements\` (object, optional): Performance constraints
  - \`maxLatency\` (number): Maximum acceptable latency (ms)
  - \`throughput\` (number): Required throughput (ops/sec)
  - \`memoryLimit\` (number): Memory limit (MB)

**Returns:**
- \`analysis\` (object): Detailed requirement analysis
- \`recommendations\` (array): Recommended approaches
- \`complexity\` (string): Estimated complexity ('low', 'medium', 'high')

**Example:**
\`\`\`javascript
const analysis = await fixiplug.dispatch('sqlite.extension.analyze', {
  description: 'Real-time streaming aggregation with rolling windows',
  domain: 'analytics',
  performanceRequirements: {
    maxLatency: 1,      // 1ms max
    throughput: 10000,  // 10k ops/sec
    memoryLimit: 100    // 100MB
  }
});

console.log(analysis.analysis);
// {
//   requirementType: 'streaming-aggregation',
//   estimatedComplexity: 'high',
//   keyChallenge: 'Maintaining rolling window state efficiently',
//   suggestedApproaches: ['ring-buffer', 'sliding-window']
// }

console.log(analysis.recommendations);
// [
//   {
//     backend: 'mojo',
//     confidence: 0.95,
//     reasoning: 'Best for sub-millisecond latency with high throughput',
//     pros: ['Ultra-low latency', 'Zero-copy operations', 'SIMD support'],
//     cons: ['Newer ecosystem', 'Limited libraries']
//   },
//   {
//     backend: 'rust',
//     confidence: 0.88,
//     reasoning: 'Excellent balance of performance and safety',
//     pros: ['Memory safety', 'Rich ecosystem', 'Mature tooling'],
//     cons: ['Slightly higher latency than Mojo']
//   }
// ]
\`\`\`

### sqlite.extension.recommend_path

Get recommended implementation path for requirements.

**Parameters:**
- \`requirements\` (object, required): Implementation requirements
  - \`description\` (string): What to build
  - \`performanceLevel\` (string): 'speed', 'balanced', or 'size'
- \`constraints\` (object, optional): Additional constraints
  - \`teamExperience\` (array): Languages team knows
  - \`deploymentTarget\` (string): Target platform

**Returns:**
- \`path\` (object): Recommended implementation path
- \`steps\` (array): Implementation steps
- \`estimatedEffort\` (string): Effort estimate

**Example:**
\`\`\`javascript
const path = await fixiplug.dispatch('sqlite.extension.recommend_path', {
  requirements: {
    description: 'Customer lifetime value calculation',
    performanceLevel: 'balanced'
  },
  constraints: {
    teamExperience: ['python', 'javascript'],
    deploymentTarget: 'linux-x64'
  }
});

console.log(path.path);
// {
//   backend: 'rust',
//   reasoning: 'Team can learn Rust easily from Python/JS, balanced performance',
//   learningCurve: 'moderate',
//   timeToProduction: '2-3 weeks'
// }

console.log(path.steps);
// [
//   'Set up Rust development environment',
//   'Implement core CLV calculation logic',
//   'Add SQLite FFI bindings',
//   'Write unit tests and benchmarks',
//   'Build and package extension'
// ]
\`\`\`

### sqlite.extension.generate

Generate complete SQLite extension with tests and build instructions.

**Parameters:**
- \`description\` (string, required): Extension functionality description
- \`backend\` (string, required): Backend language ('c', 'rust', 'mojo')
- \`performanceLevel\` (string, optional): Optimization level ('speed', 'balanced', 'size', default: 'balanced')
- \`includeTests\` (boolean, optional): Include test suite (default: true)
- \`includeBenchmarks\` (boolean, optional): Include benchmarks (default: true)
- \`metadata\` (object, optional): Additional metadata

**Returns:**
- \`code\` (string): Extension source code
- \`tests\` (string): Test suite code
- \`benchmarks\` (string): Benchmark code
- \`buildInstructions\` (string): How to build
- \`usage\` (string): Usage examples
- \`metadata\` (object): Generation metadata

**Example:**
\`\`\`javascript
const extension = await fixiplug.dispatch('sqlite.extension.generate', {
  description: 'Calculate portfolio Sharpe ratio with configurable risk-free rate',
  backend: 'rust',
  performanceLevel: 'speed',
  includeTests: true,
  includeBenchmarks: true,
  metadata: {
    author: 'trading-team',
    version: '1.0.0'
  }
});

console.log('Generated code length:', extension.code.length);
console.log('Test coverage:', extension.metadata.testCoverage);

// Save to files
import fs from 'fs';
fs.writeFileSync('sharpe_ratio.rs', extension.code);
fs.writeFileSync('tests.rs', extension.tests);
fs.writeFileSync('BUILD.md', extension.buildInstructions);
\`\`\`

**Example Output Structure:**
\`\`\`javascript
{
  code: \`
    use rusqlite::functions::FunctionContext;

    pub fn sharpe_ratio(ctx: &FunctionContext) -> rusqlite::Result<f64> {
      let returns: Vec<f64> = ctx.get(0)?;
      let risk_free_rate: f64 = ctx.get(1)?;
      // ... implementation
    }
  \`,
  tests: \`
    #[test]
    fn test_sharpe_ratio_positive() {
      // ... tests
    }
  \`,
  benchmarks: \`
    #[bench]
    fn bench_sharpe_ratio(b: &mut Bencher) {
      // ... benchmarks
    }
  \`,
  buildInstructions: "# Building\\n\\n1. Install Rust...\\n2. cargo build --release...",
  usage: "-- SQL Usage\\nSELECT sharpe_ratio(returns, 0.02) FROM portfolio;",
  metadata: {
    backend: 'rust',
    performanceLevel: 'speed',
    estimatedPerformance: '< 1ms for 1000 data points',
    testCoverage: '95%',
    linesOfCode: 247,
    generatedAt: '2025-11-20T10:30:00Z'
  }
}
\`\`\`

### sqlite.extension.quick_generate

Quick generation from description (uses smart defaults).

**Parameters:**
- \`description\` (string, required): What to build
- \`backend\` (string, optional): Backend language (auto-selected if omitted)

**Returns:**
- Same as \`sqlite.extension.generate\` but with auto-selected options

**Example:**
\`\`\`javascript
// Simplest usage - let it choose everything
const extension = await fixiplug.dispatch('sqlite.extension.quick_generate', {
  description: 'Calculate moving average over 30-day window'
});

// Backend auto-selected based on requirements
console.log(\`Generated in \${extension.metadata.backend}\`);
\`\`\`

## Backend Language Guidance

### When to Use C
**Best for:**
- Maximum portability
- Minimal dependencies
- Integrating with existing C code
- Platforms where Rust/Mojo unavailable

**Characteristics:**
- Latency: Low (~1-5ms)
- Memory safety: Manual
- Ecosystem: Mature, stable
- Learning curve: Moderate

### When to Use Rust
**Best for:**
- Production systems requiring safety
- Complex logic with many edge cases
- Teams familiar with modern languages
- Long-term maintenance

**Characteristics:**
- Latency: Very low (~0.5-2ms)
- Memory safety: Guaranteed
- Ecosystem: Growing rapidly
- Learning curve: Moderate-High

### When to Use Mojo
**Best for:**
- Ultra-low latency requirements (<1ms)
- High-throughput streaming data
- SIMD-heavy computations
- Cutting-edge performance

**Characteristics:**
- Latency: Ultra-low (~0.1-0.5ms)
- Memory safety: High
- Ecosystem: Emerging
- Learning curve: Moderate (if you know Python)

## Best Practices

1. **Start with Analysis**
   - Always run \`sqlite.extension.analyze\` first
   - Review recommendations before generating
   - Consider team expertise and constraints

2. **Choose Appropriate Performance Level**
   - \`speed\`: Maximum performance, larger binary
   - \`balanced\`: Good performance, reasonable size (recommended)
   - \`size\`: Minimal binary size, acceptable performance

3. **Always Include Tests**
   - Set \`includeTests: true\` (default)
   - Review and extend generated tests
   - Add domain-specific test cases

4. **Review Generated Code**
   - Generated code is production-quality but review it
   - Customize for your specific use case
   - Add domain-specific validation

5. **Benchmark Before Deploying**
   - Use generated benchmarks
   - Test with realistic data volumes
   - Measure actual latency in your environment

## Performance Characteristics

### Generation Speed
- Analysis: ~500ms
- Code generation: ~2-5 seconds
- Full suite (code + tests + benchmarks): ~5-10 seconds

### Generated Extension Performance
| Backend | Typical Latency | Throughput | Binary Size |
|---------|----------------|------------|-------------|
| C       | 1-5ms          | 1k-10k/s   | 50-200 KB   |
| Rust    | 0.5-2ms        | 5k-50k/s   | 200-500 KB  |
| Mojo    | 0.1-0.5ms      | 50k-500k/s | 100-300 KB  |

*Note: Actual performance depends on extension complexity*

## Common Use Cases

### Use Case 1: Financial Calculations
\`\`\`javascript
// Generate Sharpe ratio calculator
const extension = await fixiplug.dispatch('sqlite.extension.generate', {
  description: 'Sharpe ratio calculation for portfolio performance',
  backend: 'rust',
  performanceLevel: 'speed',
  includeTests: true
});

// Deploy to database
// ... save code and build
\`\`\`

### Use Case 2: Analytics Aggregations
\`\`\`javascript
// Generate custom aggregation function
const extension = await fixiplug.dispatch('sqlite.extension.generate', {
  description: 'Custom percentile aggregation with interpolation',
  backend: 'mojo',
  performanceLevel: 'speed',
  includeTests: true,
  includeBenchmarks: true
});
\`\`\`

### Use Case 3: String Processing
\`\`\`javascript
// Generate text processing function
const extension = await fixiplug.dispatch('sqlite.extension.quick_generate', {
  description: 'Fuzzy string matching using Levenshtein distance'
});
// Auto-selects C for portability
\`\`\`

### Use Case 4: Exploration
\`\`\`javascript
// Analyze first to explore options
const analysis = await fixiplug.dispatch('sqlite.extension.analyze', {
  description: 'Real-time fraud detection scoring',
  domain: 'security',
  performanceRequirements: {
    maxLatency: 10,
    throughput: 1000
  }
});

// Review recommendations
analysis.recommendations.forEach(rec => {
  console.log(\`\${rec.backend}: \${rec.reasoning}\`);
});

// Generate based on analysis
const extension = await fixiplug.dispatch('sqlite.extension.generate', {
  description: 'Real-time fraud detection scoring',
  backend: analysis.recommendations[0].backend,
  performanceLevel: 'speed'
});
\`\`\`

## Error Handling

Possible errors:
- \`ValidationError\`: Invalid parameters
- \`GenerationError\`: Code generation failed
- \`ServiceError\`: SQLite service unavailable
- \`TimeoutError\`: Generation exceeded timeout

Example:
\`\`\`javascript
try {
  const extension = await fixiplug.dispatch('sqlite.extension.generate', params);
} catch (error) {
  if (error.name === 'GenerationError') {
    console.error('Generation failed:', error.details);
    console.error('Suggestions:', error.suggestions);
  } else if (error.name === 'TimeoutError') {
    console.error('Generation timed out, try simplifying requirements');
  } else {
    console.error('Unexpected error:', error.message);
  }
}
\`\`\`

## Prerequisites

- SQLite Extensions Framework installed
- Environment variable: \`SQLITE_FRAMEWORK_PATH\`
- Backend language toolchain (for building generated code):
  - C: gcc or clang
  - Rust: rustc + cargo
  - Mojo: mojo compiler

## Related Skills

- \`sqlite-pattern-learner\`: Find proven patterns before generating
- \`sqlite-agent-amplification\`: Create dynamic tools from extensions
- \`sqlite-agent-context\`: Understand agent capabilities

## Version

1.0.0 - Initial release`,
    tags: ['database', 'code-generation', 'extensions', 'performance', 'sqlite'],
    version: '1.0.0'
  },

  async setup(ctx) {
    // Service instance (lazy-loaded)
    let service = null;

    /**
     * Get or create service instance
     */
    async function getService() {
      if (!service) {
        try {
          const { createService } = await import('../sdk/adapters/sqlite-framework/index.js');

          const frameworkPath = process.env.SQLITE_FRAMEWORK_PATH;
          if (!frameworkPath) {
            throw new Error(
              'SQLITE_FRAMEWORK_PATH environment variable not set. ' +
              'Please set it to the path of your SQLite Extensions Framework installation.'
            );
          }

          service = await createService({
            frameworkPath,
            maxProcesses: parseInt(process.env.SQLITE_MAX_PROCESSES) || 4,
            requestTimeout: parseInt(process.env.SQLITE_REQUEST_TIMEOUT) || 60000,  // 60s for generation
            cacheEnabled: process.env.SQLITE_CACHE_ENABLED !== 'false'
          });

          console.log('[sqliteExtensionGenerator] Service initialized');
        } catch (error) {
          console.error('[sqliteExtensionGenerator] Failed to initialize service:', error.message);
          throw error;
        }
      }
      return service;
    }

    /**
     * Hook: Analyze requirements
     */
    ctx.on('sqlite.extension.analyze', async (params) => {
      try {
        const svc = await getService();
        const result = await svc.analyzeRequirements({
          description: params.description,
          domain: params.domain,
          performanceRequirements: params.performanceRequirements
        });
        return result;
      } catch (error) {
        console.error('[sqliteExtensionGenerator] Error in sqlite.extension.analyze:', error);
        throw error;
      }
    });

    /**
     * Hook: Recommend implementation path
     */
    ctx.on('sqlite.extension.recommend_path', async (params) => {
      try {
        const svc = await getService();
        const result = await svc.recommendPath({
          requirements: params.requirements,
          constraints: params.constraints
        });
        return result;
      } catch (error) {
        console.error('[sqliteExtensionGenerator] Error in sqlite.extension.recommend_path:', error);
        throw error;
      }
    });

    /**
     * Hook: Generate extension
     */
    ctx.on('sqlite.extension.generate', async (params) => {
      try {
        const svc = await getService();
        const result = await svc.generateExtension({
          description: params.description,
          backend: params.backend,
          performanceLevel: params.performanceLevel || 'balanced',
          includeTests: params.includeTests !== false,  // default true
          includeBenchmarks: params.includeBenchmarks !== false,  // default true
          metadata: params.metadata
        });
        return result;
      } catch (error) {
        console.error('[sqliteExtensionGenerator] Error in sqlite.extension.generate:', error);
        throw error;
      }
    });

    /**
     * Hook: Quick generation with smart defaults
     */
    ctx.on('sqlite.extension.quick_generate', async (params) => {
      try {
        const svc = await getService();
        const result = await svc.quickExtensionFromDescription({
          description: params.description,
          backend: params.backend  // optional - auto-selects if not provided
        });
        return result;
      } catch (error) {
        console.error('[sqliteExtensionGenerator] Error in sqlite.extension.quick_generate:', error);
        throw error;
      }
    });

    /**
     * Cleanup on plugin unload
     */
    ctx.on('unload', async () => {
      if (service) {
        try {
          await service.shutdown();
          console.log('[sqliteExtensionGenerator] Service shutdown complete');
        } catch (error) {
          console.error('[sqliteExtensionGenerator] Error during shutdown:', error);
        }
        service = null;
      }
    });

    console.log('[sqliteExtensionGenerator] Plugin initialized');
  }
};
