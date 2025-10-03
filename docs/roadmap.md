# FixiPlug Roadmap

## LLM Agent-Friendly Plugins

This document outlines promising plugin ideas specifically designed to enable
LLM agents to interact with FixiPlug-powered applications.

### High Priority

#### 1. Agent Command Interface

**Purpose**: Provide a high-level imperative API for common agent workflows

**Hooks Exposed**:

- `agent:fillForm` - Fill form fields by label/name
- `agent:clickButton` - Click buttons by text/role
- `agent:waitFor` - Wait for element or state
- `agent:navigate` - Navigate to URL or trigger action
- `agent:extract` - Extract structured data from page

**API Methods**:

- `api:executeCommand` - Execute command from DSL
- `api:getCommandSchema` - Get available commands

**Agent Use Cases**:

- Simplified action execution without DOM knowledge
- Declarative workflow definition
- Cross-application consistency

#### 2. Semantic Context Annotator

**Purpose**: Automatically annotate DOM elements with semantic metadata

**Hooks Exposed**:

- `annotate:element` - Add semantic metadata to elements
- `annotate:refresh` - Recompute annotations after DOM changes

**API Methods**:

- `api:getElementContext` - Get semantic info for element
- `api:queryByIntent` - Find elements by purpose ("submit button", "email
  field")
- `api:getPageSchema` - Get full page semantic structure

**Agent Use Cases**:

- Natural language DOM queries
- Understanding page structure without CSS selectors
- Accessibility-first element discovery

#### 3. State Machine Tracker

**Purpose**: Track and expose application state transitions

**Hooks Exposed**:

- `state:transition` - Fired on state changes
- `state:query` - Query current state

**API Methods**:

- `api:getCurrentState` - Get current state object
- `api:waitForState` - Promise that resolves when state is reached
- `api:getStateHistory` - Get state transition history

**Agent Use Cases**:

- Knowing when async actions complete
- Understanding UI states (loading, error, success, idle)
- Coordinating multi-step workflows

#### 4. Capability Discovery

**Purpose**: Auto-generate documentation of available actions

**Hooks Exposed**:

- `capability:register` - Register custom capabilities
- `capability:query` - Query for capabilities

**API Methods**:

- `api:getCapabilities` - List all available actions
- `api:getActionSchema` - Get schema for specific action
- `api:discoverEndpoints` - Find all fx-action endpoints

**Agent Use Cases**:

- Self-service API discovery
- Zero-shot application interaction
- Autonomous exploration

### Medium Priority

#### 5. Form Validation Schema Extractor

**Purpose**: Build JSON schemas from form validation rules

**Hooks Exposed**:

- `schema:extract` - Extract schema from form
- `schema:validate` - Validate data against schema

**API Methods**:

- `api:getFormSchema` - Get JSON schema for form
- `api:validateFormData` - Validate data object
- `api:generateSampleData` - Generate valid sample data

**Agent Use Cases**:

- Auto-generating valid form data
- Understanding input requirements and constraints
- Form testing automation

#### 6. Action Recorder & Replay

**Purpose**: Capture and replay user interaction sequences

**Hooks Exposed**:

- `recorder:start` - Start recording
- `recorder:stop` - Stop recording
- `recorder:replay` - Replay recorded sequence

**API Methods**:

- `api:getActionHistory` - Get recorded actions
- `api:replayActions` - Replay action sequence
- `api:exportRecording` - Export as JSON

**Agent Use Cases**:

- Learning from user workflows
- Generating automated tests
- Debugging interaction sequences

#### 7. Dependency Graph Builder

**Purpose**: Map relationships between actions and their side effects

**Hooks Exposed**:

- `dependency:track` - Track action dependencies
- `dependency:analyze` - Analyze dependency chains

**API Methods**:

- `api:getDependencyGraph` - Get full dependency graph
- `api:getPossibleSideEffects` - Predict side effects of action
- `api:getRequiredPreconditions` - Get prerequisites for action

**Agent Use Cases**:

- Understanding cascading updates
- Optimizing multi-step workflows
- Preventing unintended consequences

#### 8. Natural Language Query Engine

**Purpose**: Query page state with natural language

**Hooks Exposed**:

- `query:natural` - Process NL query
- `query:register` - Register custom query handlers

**API Methods**:

- `api:query` - Execute natural language query
- `api:suggest` - Get query suggestions

**Agent Use Cases**:

- Direct agent-to-page communication
- Exploratory interaction
- Simplified data extraction

### Lower Priority

#### 9. Undo/Redo Manager

**Purpose**: Maintain reversible action history

**Hooks Exposed**:

- `history:snapshot` - Create state snapshot
- `history:restore` - Restore previous state

**API Methods**:

- `api:undo` - Undo last action
- `api:redo` - Redo undone action
- `api:getHistory` - Get action history with undo points

**Agent Use Cases**:

- Safe experimentation
- Error recovery
- Exploration without consequences

#### 10. DOM Diff Generator

**Purpose**: Generate structured diffs of DOM changes

**Hooks Exposed**:

- `diff:before` - Capture before state
- `diff:after` - Capture after state and compute diff

**API Methods**:

- `api:getLastDiff` - Get most recent diff
- `api:getDiffHistory` - Get all diffs
- `api:compareDOMs` - Compare two DOM states

**Agent Use Cases**:

- Understanding what changed
- Generating changelogs
- Debugging unexpected mutations

#### 11. Cost Estimator

**Purpose**: Track and predict operation costs

**Hooks Exposed**:

- `cost:measure` - Measure operation cost
- `cost:estimate` - Estimate future cost

**API Methods**:

- `api:estimateCost` - Get estimated cost for action
- `api:getCostReport` - Get detailed cost breakdown
- `api:setCostBudget` - Set operation budget limits

**Agent Use Cases**:

- Optimizing workflow efficiency
- Estimating action complexity
- Budget-aware operation planning

#### 12. Intent Classifier

**Purpose**: Classify user intent from requests/responses

**Hooks Exposed**:

- `intent:classify` - Classify action intent
- `intent:register` - Register custom intent types

**API Methods**:

- `api:classifyAction` - Get intent classification
- `api:suggestActions` - Suggest actions for intent
- `api:getIntentHistory` - Get classified intent history

**Agent Use Cases**:

- Understanding action semantics
- Suggesting alternative approaches
- Learning interaction patterns

## Implementation Phases

### Phase 1: Foundation (Q1)

- Agent Command Interface
- State Machine Tracker
- Capability Discovery

### Phase 2: Intelligence (Q2)

- Semantic Context Annotator
- Form Validation Schema Extractor
- Dependency Graph Builder

### Phase 3: Advanced (Q3)

- Natural Language Query Engine
- Action Recorder & Replay
- DOM Diff Generator

### Phase 4: Optimization (Q4)

- Intent Classifier
- Undo/Redo Manager
- Cost Estimator

## Design Principles

1. **Observable**: Every plugin exposes hooks that agents can listen to
2. **Queryable**: Every plugin provides `api:*` hooks for data retrieval
3. **Composable**: Plugins should work together and enhance each other
4. **Stateless**: API calls should be idempotent when possible
5. **Documented**: Auto-generate schemas for all hooks and APIs
6. **Backward Compatible**: New features should not break existing plugins

## Success Metrics

- Agent can interact with FixiPlug app without reading source code
- Agent can discover capabilities through API alone
- Agent can execute common workflows with <5 API calls
- Agent can recover from errors autonomously
- Agent can learn optimal interaction patterns over time
