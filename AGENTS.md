# AI Agent Instructions

## FramingUI Workflow For Shadowoo Mobile

### Overview

Shadowoo mobile is an Expo + React Native app. In this repository, FramingUI is used as a direct-write design system assistant, not as a React Native runtime component library.

The expected workflow is:

1. detect project context
2. gather React Native screen guidance
3. write React Native code directly
4. run environment and source validation

### Local MCP Setup

- Use the workspace `.mcp.json` at the repository root.
- It points to the local FramingUI worktree build:

```json
{
  "mcpServers": {
    "framingui": {
      "command": "node",
      "args": [
        "/Users/sooyeon/Developer/worktrees/framingui-rn-direct-write/packages/mcp-server/dist/index.js"
      ]
    }
  }
}
```

- If the local server is rebuilt, use the updated `dist` output from that worktree.

### Authentication

Some FramingUI discovery APIs still require login.

Check status:

```bash
framingui-mcp status
```

If needed:

```bash
framingui-mcp login
```

### Required Workflow

#### Step 1. Detect Project Context

Run `detect-project-context` first.

Example input:

```json
{
  "projectPath": "/Users/sooyeon/Developer/shadowoo/apps/mobile"
}
```

Expected result:

- `platform: "react-native"`
- `runtime: "expo"`
- recommended defaults for subsequent tools

After this step, downstream tools can inherit the detected platform defaults.

#### Step 2. Gather Screen Guidance

Run `get-screen-generation-context`.

Example input:

```json
{
  "description": "signup screen with email, password, CTA, error state",
  "includeExamples": true
}
```

For Shadowoo mobile, this should resolve to the React Native direct-write workflow. Do not assume Tailwind, CSS imports, or `@framingui/ui` runtime components.

Use discovery tools as needed:

- `list-components`
- `preview-component`
- `list_tokens`

#### Step 3. Write React Native Code Directly

Write RN code in the existing Shadowoo style:

- `StyleSheet.create`
- Expo / `expo-router`
- `View`, `Text`, `Pressable`, `TextInput`, `ScrollView`
- existing local primitives and theme patterns when available

Do not introduce:

- web-only `className`
- Tailwind-specific guidance
- `@framingui/ui` imports
- raw hex values when project tokens or shared constants already exist

#### Step 4. Validate Environment And Source Files

Run `validate-environment` after writing code.

Example input:

```json
{
  "projectPath": "/Users/sooyeon/Developer/shadowoo/apps/mobile",
  "sourceFiles": [
    "/Users/sooyeon/Developer/shadowoo/apps/mobile/app/(auth)/signup.tsx"
  ]
}
```

This should:

- confirm Expo / React Native environment detection
- avoid web-only Tailwind requirements
- flag RN direct-write issues such as:
  - raw hex or rgb colors
  - hardcoded spacing or radius
  - web-only patterns like `className`

### Shadowoo-Specific Rules

1. Prefer direct-write React Native screens over screen-definition export.
2. Treat FramingUI as contract, guidance, and QC.
3. Preserve existing Expo and `StyleSheet` patterns.
4. Validate with FramingUI MCP before considering a screen done.
5. If a tool response looks web-first, re-run after `detect-project-context` and keep the mobile `projectPath` explicit.

### Best Practices

1. Always run `detect-project-context` first in this repo.
2. Keep mobile work in `apps/mobile`.
3. Prefer RN primitives and existing shared helpers over new abstractions.
4. Use FramingUI for tokens, constraints, and review guidance.
5. Run `validate-environment` on changed RN files before finishing.
