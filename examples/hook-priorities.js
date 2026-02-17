/**
 * Hook priority example
 *
 * Demonstrates how priorities control execution order: higher values run first.
 * Use priorities for validation (HIGH), processing (NORMAL), and logging (LOW).
 *
 * Run: node examples/hook-priorities.js
 */

import { createFixiplug } from "../builder/fixiplug-factory.js";

const fp = createFixiplug({ features: ["logging"] });

const PRIORITY = { HIGH: 100, NORMAL: 0, LOW: -100 };

// Validator runs first (HIGH priority)
// Marks data with errors — downstream handlers can check data.errors
const validator = {
  name: "validator",
  setup(ctx) {
    ctx.on("form:submit", (data) => {
      console.log("[validator] Checking data...");
      if (!data.email || !data.email.includes("@")) {
        return { ...data, errors: ["Invalid email"], validated: false };
      }
      return { ...data, validated: true };
    }, PRIORITY.HIGH);
  }
};

// Processor runs second (NORMAL priority)
// Skips processing if validation failed
const processor = {
  name: "processor",
  setup(ctx) {
    ctx.on("form:submit", (data) => {
      if (data.errors) {
        console.log("[processor] Skipping — validation failed");
        return data;
      }
      console.log("[processor] Processing submission...");
      return { ...data, processed: true, timestamp: Date.now() };
    }, PRIORITY.NORMAL);
  }
};

// Logger runs last (LOW priority)
const auditLogger = {
  name: "audit-logger",
  setup(ctx) {
    ctx.on("form:submit", (data) => {
      console.log("[audit] Submission logged:", data.email);
      return data;
    }, PRIORITY.LOW);
  }
};

// Register in any order — priorities determine execution order
fp.use(auditLogger);
fp.use(validator);
fp.use(processor);

// Valid submission
const result = await fp.dispatch("form:submit", {
  email: "user@example.com",
  message: "Hello"
});
console.log("\nResult:", result);
// => { email: "user@example.com", message: "Hello", validated: true, processed: true, ... }

// Invalid submission — validator marks errors, processor skips
console.log("\n--- Invalid submission ---");
const result2 = await fp.dispatch("form:submit", { email: "bad", message: "test" });
console.log("Result:", result2);
// => { email: "bad", message: "test", errors: ["Invalid email"], validated: false }
