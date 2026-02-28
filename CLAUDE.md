# Project Instructions

## FramingUI Workflow (Claude Code)

### MCP Server Connection

FramingUI MCP server is configured in `.mcp.json`. Claude Code automatically loads 15 tools for screen generation.

### Authentication (Step 1)

Before generating any screens, authenticate:

```bash
framingui-mcp login
```

**Important:** All 6 themes require authentication. No free themes are available.

### Screen Generation Workflow (3 Steps)

**Step 1/3:** Gather Context

- Call `get-screen-generation-context` with user's screen description
- Receive template matches, component suggestions with inline props/variants, and schema

**Step 2/3:** Validate Definition

- Generate Screen Definition JSON based on context
- Call `validate-screen-definition` to verify structure
- Apply autoFixPatches or fix any errors before proceeding

**After Validation:** Write React Code Directly

- Use components and import statements from Step 1 context
- Apply theme recipes via variant props

**Step 3/3:** Validate Environment (Optional)

- Call `validate-environment` with project path and required packages
- Verify Tailwind CSS configuration
- Show user install commands for missing packages

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
        <CardTitle>Welcome to FramingUI</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default" size="lg">
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Available Tools

**Discovery (6 tools):**

- `list-themes` - List 6 available themes
- `preview-theme` - Get theme design tokens
- `list-components` - List 30+ UI components
- `preview-component` - Get component props and variants
- `list-screen-templates` - List 13 screen templates
- `preview-screen-template` - Get template structure

**Screen Generation (3 tools):**

- `get-screen-generation-context` - Step 1/3
- `validate-screen-definition` - Step 2/3
- `validate-environment` - Step 3/3 (Optional)

**Quick Prototyping (3 tools):**

- `generate-blueprint` - Quick UI structure
- `export-screen` - Export to JSX/TSX/Vue
- `list_tokens` - List layout tokens

**Icon Libraries (2 tools):**

- `list-icon-libraries` - List available icon libraries
- `preview-icon-library` - Preview icon library

**Additional:**

- `validate_screen` - Simple validation (use `validate-screen-definition` for production)

### MCP Prompts (Universal Guidance)

Claude Code can access built-in prompts for guidance:

- `getting-started` - Authentication → Theme → Components → Screen generation
- `screen-workflow` - Detailed 3-step workflow with troubleshooting

These prompts work across all MCP clients, not just Claude Code.

### Common Mistakes to Avoid

1. ❌ Skipping authentication before generating screens
2. ❌ Using non-existent theme IDs (only 6 exist)
3. ❌ Skipping validate-screen-definition step
4. ❌ Delivering code without verifying Tailwind config

### Troubleshooting

**Authentication issues:**

- Run `framingui-mcp status` to check authentication
- Run `framingui-mcp login` to re-authenticate

**Missing styles:**

- Run `validate-environment` to check Tailwind config
- Verify `@framingui/ui` content paths are included
- Check `tailwindcss-animate` plugin is configured

**Component not found:**

- Use `list-components` to verify component exists
- Use `preview-component` to check correct component ID
