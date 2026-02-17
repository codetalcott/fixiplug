/**
 * Basic FixiPlug plugin example
 *
 * Demonstrates creating plugins, registering hooks, and dispatching events.
 *
 * Run: node examples/basic-plugin.js
 */

import { createFixiplug } from "../builder/fixiplug-factory.js";

// Create a fixiplug instance with logging enabled
const fp = createFixiplug({ features: ["logging"] });

// --- Define plugins ---

const greeterPlugin = {
  name: "greeter",
  setup(ctx) {
    ctx.on("greet", (data) => {
      const message = `Hello, ${data.name}!`;
      console.log(message);
      return { ...data, message };
    });
  }
};

const uppercasePlugin = {
  name: "uppercaser",
  setup(ctx) {
    // Lower priority runs after greeter
    ctx.on("greet", (data) => {
      return { ...data, message: data.message.toUpperCase() };
    }, -10);
  }
};

// --- Register plugins ---

fp.use(greeterPlugin);
fp.use(uppercasePlugin);

// --- Dispatch events ---

const result = await fp.dispatch("greet", { name: "World" });
console.log("Result:", result);
// => { name: "World", message: "HELLO, WORLD!" }

// --- Plugin management ---

console.log("Plugins:", fp.getPlugins());
// => ["greeter", "uppercaser"]

// Disable a plugin (hooks won't fire, but plugin stays registered)
fp.disable("uppercaser");

const result2 = await fp.dispatch("greet", { name: "FixiPlug" });
console.log("Without uppercaser:", result2.message);
// => "Hello, FixiPlug!"

// Re-enable it
fp.enable("uppercaser");
