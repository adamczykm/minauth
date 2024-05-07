// File: scripts/serve-plugin-server.js
const path = require("path");
const { execSync } = require("child_process");

console.log(process.argv);

if (process.argv.length < 3) {
  console.error("Please provide a path to resolve, e.g., 'minauth/dist/tools/plugin-server/index.js'");
  process.exit(1);
}

// The first two elements in `process.argv` are 'node' and the script name
const packagePath = process.argv[2];

// Attempt to resolve the package
try {
  const resolvedPath = require.resolve(packagePath);
  execSync(`bunx node ${resolvedPath}`, { stdio: "inherit" });
} catch (error) {
  console.error(`Error: Unable to resolve path "${packagePath}"`);
  process.exit(1);
}

