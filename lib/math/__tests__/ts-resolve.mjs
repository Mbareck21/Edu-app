// Lets `node --test` load the extensionless relative imports used by lib/math.
// Node strips the TypeScript types itself (Node 22.6+); this only fixes lookup.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL) {
      const guess = fileURLToPath(new URL(specifier, context.parentURL)) + ".ts";
      if (existsSync(guess)) return { url: pathToFileURL(guess).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
