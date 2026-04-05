const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch shared packages
config.watchFolders = [workspaceRoot];

// Resolve shared package modules from workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Explicitly map packages that pnpm hoists to workspace root (pnpm + monorepo fix)
config.resolver.extraNodeModules = new Proxy(
  {},
  {
    get: (target, name) => {
      if (typeof name !== "string") return undefined;
      if (name in target) return target[name];
      return path.join(workspaceRoot, "node_modules", name);
    },
  },
);

module.exports = config;
