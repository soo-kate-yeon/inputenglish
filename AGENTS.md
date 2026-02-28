# AI Agent Instructions

## FramingUI Workflow (AI Agents)

### Overview

FramingUI MCP server provides 15 tools for screen generation via Model Context Protocol (MCP). This guide is for AI agents on platforms like OpenAI Codex, Cursor, Windsurf, and other MCP-compatible clients.

### Prerequisites

1. **MCP Server Running:** Ensure `@framingui/mcp-server` is running and connected
2. **Authentication:** User must run `framingui-mcp login` before generating screens
3. **Project Setup:** `@framingui/ui` and `tailwindcss-animate` must be installed

### Required Authentication Flow

**Step 1:** Check authentication status

```bash
framingui-mcp status
```

**Step 2:** If not authenticated, instruct user:

```bash
framingui-mcp login
```

**Important:** All 6 themes require valid licenses. There are no free themes available.

### Screen Generation Workflow (3 Steps)

Follow this exact sequence for production-ready screens:

#### Step 1/3: Gather Context

**Tool:** `get-screen-generation-context`

**Purpose:** Get all context needed to create Screen Definition

**Input:**

```json
{
  "description": "user dashboard with profile card",
  "themeId": "minimal-workspace",
  "includeExamples": true
}
```

**Output:** Template matches, component suggestions with inline props/variants, schema, examples

#### Step 2/3: Validate Definition

**Tool:** `validate-screen-definition`

**Purpose:** Ensure Screen Definition JSON is correct

**Input:**

```json
{
  "definition": {
    "id": "user-dashboard",
    "shell": "shell.web.dashboard",
    "page": "page.dashboard",
    "sections": [...]
  },
  "strict": true
}
```

**Output:** Validation results with errors, warnings, suggestions, and autoFix patches

**Critical:** Always validate before writing code. Apply autoFixPatches or fix all errors.

#### After Validation: Write React Code Directly

**No tool needed** - Write production-ready React code using components from Step 1 context.

Use the import statements and props provided in the context response.

#### Step 3/3: Validate Environment (Optional)

**Tool:** `validate-environment`

**Purpose:** Verify project has required packages and Tailwind config

**Input:**

```json
{
  "projectPath": "/path/to/package.json",
  "requiredPackages": ["@radix-ui/react-slot", "@radix-ui/react-avatar"],
  "checkTailwind": true
}
```

**Output:** Missing packages, install commands, Tailwind validation

**Critical:** Always inform user about missing packages and Tailwind config issues.

### Discovery Tools

Before generating screens, explore available resources:

**Themes (6 total, all require authentication):**

- `list-themes` → See all 6 themes
- `preview-theme` → Get theme design tokens

**Components (30+ available):**

- `list-components` → Browse component catalog
- `preview-component` → Get component props, variants, examples

**Templates (13 available):**

- `list-screen-templates` → Browse screen templates
- `preview-screen-template` → Get template structure

### Component Usage Example

```tsx
// app/page.tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@framingui/ui";

export default function Page() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">Get Started</Button>
      </CardContent>
    </Card>
  );
}
```

### MCP Prompts (Universal Guidance)

Your MCP client may support prompts. If available:

- `getting-started` - Complete onboarding guide
- `screen-workflow` - Detailed 3-step workflow

These provide context to help you guide users effectively.

### Error Handling

**Authentication errors:**

- Instruct user to run `framingui-mcp login`
- Verify with `framingui-mcp status`

**Validation errors (Step 2):**

- Read error messages - they include suggestions
- Fix errors in Screen Definition
- Re-run `validate-screen-definition`

**Missing dependencies (Step 3):**

- Always run Step 4 to check environment
- Show user install commands from `validate-environment`

**Missing styles (runtime):**

- Run `validate-environment` to diagnose
- Check Tailwind config includes `@framingui/ui` content paths
- Check `tailwindcss-animate` plugin is configured

### Best Practices

1. ✅ Always authenticate before generating screens
2. ✅ Follow all 3 workflow steps in order
3. ✅ Validate before writing code (Step 2)
4. ✅ Check environment before delivering code (Step 3)
5. ✅ Inform user about missing dependencies and Tailwind issues
6. ✅ Use `strict: true` for production validation

### Quick Reference: All 15 Tools

**Discovery:** list-themes, preview-theme, list-components, preview-component, list-screen-templates, preview-screen-template
**Workflow:** get-screen-generation-context, validate-screen-definition, validate-environment
**Quick:** generate-blueprint, export-screen, validate_screen, list_tokens
**Icons:** list-icon-libraries, preview-icon-library
