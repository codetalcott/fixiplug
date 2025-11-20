/**
 * Example: Using SQLite Skills for Database-Enabled Workflows
 *
 * This example demonstrates how to use the SQLite Extensions Framework integration
 * to enable LLM agents with powerful database capabilities including:
 * - Pattern learning from historical query data
 * - Automated SQLite extension generation
 * - Dynamic tool creation
 * - Agent context management
 *
 * Prerequisites:
 * - SQLite Extensions Framework installed
 * - Environment variable SQLITE_FRAMEWORK_PATH set
 * - Python 3.8+ with framework dependencies
 *
 * Usage:
 *   export SQLITE_FRAMEWORK_PATH=/path/to/sqlite-extensions-framework
 *   node examples/sqlite-skills-example.js
 */

import { createFixiplug } from '../builder/fixiplug-factory.js';
import { FixiPlugAgent } from '../sdk/agent-client.js';
import { AnthropicAdapter } from '../sdk/adapters/anthropic-adapter.js';
import introspectionPlugin from '../plugins/introspection.js';
import skillMdLoader from '../plugins/skill-md-loader.js';
import sqlitePatternLearner from '../plugins/sqlite-pattern-learner.js';
import sqliteExtensionGenerator from '../plugins/sqlite-extension-generator.js';
import sqliteAgentAmplification from '../plugins/sqlite-agent-amplification.js';
import sqliteAgentContext from '../plugins/sqlite-agent-context.js';

async function main() {
  console.log('SQLite Skills Integration Example');
  console.log('='.repeat(60));

  // Check prerequisites
  if (!process.env.SQLITE_FRAMEWORK_PATH) {
    console.error('Error: SQLITE_FRAMEWORK_PATH environment variable not set');
    console.error('Please set it to the path of your SQLite Extensions Framework installation');
    console.error('Example: export SQLITE_FRAMEWORK_PATH=/path/to/sqlite-extensions-framework');
    process.exit(1);
  }

  console.log(`Using framework: ${process.env.SQLITE_FRAMEWORK_PATH}\n`);

  // ===================================================================
  // Step 1: Setup FixiPlug with SQLite plugins
  // ===================================================================
  console.log('Step 1: Setting up FixiPlug with SQLite plugins...');

  const fixiplug = createFixiplug({ features: ['logging'] });
  fixiplug.use(introspectionPlugin);
  fixiplug.use(skillMdLoader);
  fixiplug.use(sqlitePatternLearner);
  fixiplug.use(sqliteExtensionGenerator);
  fixiplug.use(sqliteAgentAmplification);
  fixiplug.use(sqliteAgentContext);

  const agent = new FixiPlugAgent(fixiplug, { skillStrategy: 'dynamic' });
  const adapter = new AnthropicAdapter(agent, { skillStrategy: 'dynamic' });

  console.log('✓ FixiPlug configured with SQLite skills\n');

  // ===================================================================
  // Step 2: Discover available capabilities
  // ===================================================================
  console.log('Step 2: Discovering available capabilities...');

  const capabilities = await agent.discover();
  const sqliteHooks = capabilities.hooks.filter(h => h.name.startsWith('sqlite.'));

  console.log(`✓ Found ${sqliteHooks.length} SQLite hooks:`);
  sqliteHooks.forEach(hook => {
    console.log(`  - ${hook.name}`);
  });
  console.log();

  // ===================================================================
  // Step 3: Demonstrate Pattern Learning
  // ===================================================================
  console.log('Step 3: Using Pattern Learning...');

  try {
    console.log('  Getting pattern recommendations for finance domain...');

    const patterns = await fixiplug.dispatch('sqlite.patterns.get', {
      domain: 'finance',
      description: 'Calculate portfolio value at risk for risk management',
      minConfidence: 0.7,
      maxResults: 3
    });

    console.log(`  ✓ Received ${patterns.recommendations?.length || 0} recommendations`);

    if (patterns.recommendations && patterns.recommendations.length > 0) {
      console.log('\n  Top recommendation:');
      const top = patterns.recommendations[0];
      console.log(`    Pattern: ${top.pattern}`);
      console.log(`    Confidence: ${(top.confidence * 100).toFixed(1)}%`);
      console.log(`    Success rate: ${(top.successRate * 100).toFixed(1)}%`);
      console.log(`    Avg performance: ${top.avgPerformance}ms`);
    }
  } catch (error) {
    console.log(`  ⚠ Pattern learning unavailable: ${error.message}`);
  }
  console.log();

  // ===================================================================
  // Step 4: Demonstrate Extension Generation
  // ===================================================================
  console.log('Step 4: Using Extension Generator...');

  try {
    console.log('  Analyzing requirements for real-time analytics...');

    const analysis = await fixiplug.dispatch('sqlite.extension.analyze', {
      description: 'Real-time customer conversion tracking with 1-second granularity',
      domain: 'analytics',
      performanceRequirements: {
        maxLatency: 10,  // 10ms
        throughput: 1000  // 1k ops/sec
      }
    });

    console.log(`  ✓ Analysis complete`);
    console.log(`    Complexity: ${analysis.analysis?.estimatedComplexity || 'unknown'}`);
    console.log(`    Recommendations: ${analysis.recommendations?.length || 0} backend options`);

    if (analysis.recommendations && analysis.recommendations.length > 0) {
      const top = analysis.recommendations[0];
      console.log(`\n  Recommended backend: ${top.backend}`);
      console.log(`    Confidence: ${(top.confidence * 100).toFixed(1)}%`);
      console.log(`    Reasoning: ${top.reasoning}`);
    }

    // Generate extension (commented out to avoid long generation time)
    /*
    console.log('\n  Generating extension...');

    const extension = await fixiplug.dispatch('sqlite.extension.generate', {
      description: 'Real-time customer conversion tracking',
      backend: 'mojo',
      performanceLevel: 'speed',
      includeTests: true,
      includeBenchmarks: true
    });

    console.log(`  ✓ Generated extension`);
    console.log(`    Code length: ${extension.code?.length || 0} characters`);
    console.log(`    Tests included: ${extension.tests ? 'Yes' : 'No'}`);
    console.log(`    Benchmarks included: ${extension.benchmarks ? 'Yes' : 'No'}`);
    */
  } catch (error) {
    console.log(`  ⚠ Extension generation unavailable: ${error.message}`);
  }
  console.log();

  // ===================================================================
  // Step 5: Demonstrate Agent Amplification
  // ===================================================================
  console.log('Step 5: Using Agent Amplification...');

  try {
    console.log('  Creating dynamic tool for portfolio rebalancing...');

    const tool = await fixiplug.dispatch('sqlite.agent.create_tool', {
      name: 'simple_calculator',
      description: 'Simple calculator for demonstration',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['add', 'subtract', 'multiply', 'divide'],
            description: 'Operation to perform'
          },
          a: { type: 'number', description: 'First operand' },
          b: { type: 'number', description: 'Second operand' }
        },
        required: ['operation', 'a', 'b']
      },
      implementation: 'python',
      code: `
def calculate(operation, a, b):
    if operation == 'add':
        return {'result': a + b}
    elif operation == 'subtract':
        return {'result': a - b}
    elif operation == 'multiply':
        return {'result': a * b}
    elif operation == 'divide':
        if b == 0:
            return {'error': 'Division by zero'}
        return {'result': a / b}
    else:
        return {'error': 'Invalid operation'}
      `.trim()
    });

    console.log(`  ✓ Tool created: ${tool.hookName}`);

    // Use the tool
    if (tool.success && tool.hookName) {
      const result = await fixiplug.dispatch(tool.hookName, {
        operation: 'add',
        a: 5,
        b: 3
      });
      console.log(`  ✓ Tool executed: 5 + 3 = ${result.result}`);
    }
  } catch (error) {
    console.log(`  ⚠ Agent amplification unavailable: ${error.message}`);
  }
  console.log();

  // ===================================================================
  // Step 6: Demonstrate Agent Context Management
  // ===================================================================
  console.log('Step 6: Using Agent Context Management...');

  try {
    console.log('  Detecting current agent...');

    const agentInfo = await fixiplug.dispatch('sqlite.context.detect');

    console.log(`  ✓ Agent detected: ${agentInfo.type} (v${agentInfo.version})`);
    console.log(`    Confidence: ${(agentInfo.confidence * 100).toFixed(1)}%`);
    console.log(`    Capabilities: ${agentInfo.capabilities?.length || 0}`);

    if (agentInfo.capabilities && agentInfo.capabilities.length > 0) {
      console.log(`      ${agentInfo.capabilities.slice(0, 5).join(', ')}`);
    }

    // Get capabilities detail
    console.log('\n  Getting detailed capabilities...');

    const caps = await fixiplug.dispatch('sqlite.context.capabilities', {
      agentType: agentInfo.type,
      includeDetails: true
    });

    console.log(`  ✓ Capabilities loaded`);
    console.log(`    Max tokens: ${caps.maxTokens?.toLocaleString() || 'unknown'}`);
    console.log(`    Tool use support: ${caps.toolUseSupport ? 'Yes' : 'No'}`);
    console.log(`    Vision support: ${caps.visionSupport ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(`  ⚠ Agent context unavailable: ${error.message}`);
  }
  console.log();

  // ===================================================================
  // Step 7: Demonstrate LLM Integration
  // ===================================================================
  console.log('Step 7: LLM Integration...');

  console.log('  Checking LLM tool availability...');
  const tools = await adapter.getToolDefinitions();
  const retrieveSkillTool = tools.find(t => t.name === 'retrieve_skill');

  if (retrieveSkillTool) {
    console.log(`  ✓ retrieve_skill tool available for LLM`);

    // Simulate LLM retrieving a skill
    console.log('\n  Simulating LLM skill retrieval...');

    const skillContent = await adapter.executeToolUse({
      id: 'example-1',
      name: 'retrieve_skill',
      input: { skill_name: 'sqlite-pattern-learner' }
    });

    const contentLength = skillContent.content?.length || 0;
    console.log(`  ✓ Skill retrieved: ${(contentLength / 1024).toFixed(1)} KB`);
    console.log('    LLM now has instructions for using pattern learning');
  } else {
    console.log('  ⚠ retrieve_skill tool not found');
  }
  console.log();

  // ===================================================================
  // Step 8: Context Efficiency Demonstration
  // ===================================================================
  console.log('Step 8: Context Efficiency...');

  const skillNames = [
    'sqlite-pattern-learner',
    'sqlite-extension-generator',
    'sqlite-agent-amplification',
    'sqlite-agent-context'
  ];

  console.log(`  Calculating context savings for ${skillNames.length} skills...`);

  let totalSize = 0;
  for (const skillName of skillNames) {
    const result = await fixiplug.dispatch('api:getSkill', { skillName });
    if (result.success) {
      totalSize += result.skill.instructions.length;
    }
  }

  console.log(`  ✓ Total skill content: ${(totalSize / 1024).toFixed(1)} KB`);
  console.log(`    With static loading: ${(totalSize / 1024).toFixed(1)} KB in initial context`);
  console.log(`    With dynamic loading: 0 KB in initial context`);
  console.log(`    Context savings: ${(totalSize / 1024).toFixed(1)} KB (100%)`);
  console.log();

  // ===================================================================
  // Summary
  // ===================================================================
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`✓ 4 SQLite skills available to LLMs`);
  console.log(`✓ ${sqliteHooks.length} plugin hooks registered`);
  console.log(`✓ Dynamic skill loading (${(totalSize / 1024).toFixed(1)} KB savings)`);
  console.log(`✓ Full LLM integration via retrieve_skill tool`);
  console.log();
  console.log('LLM agents can now:');
  console.log('  1. Learn from proven database patterns');
  console.log('  2. Generate optimized SQLite extensions');
  console.log('  3. Create dynamic tools on-the-fly');
  console.log('  4. Understand their own capabilities');
  console.log();
  console.log('Example LLM workflow:');
  console.log('  1. LLM calls retrieve_skill("sqlite-pattern-learner")');
  console.log('  2. LLM reads instructions on pattern learning');
  console.log('  3. LLM calls sqlite.patterns.get({ domain: "finance", ... })');
  console.log('  4. LLM applies proven patterns to generate optimal code');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('\nFatal error:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});
