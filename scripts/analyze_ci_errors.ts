// scripts/analyze_ci_errors.ts
import fs from "fs";
import path from "path";

const logsDir = path.resolve("ci-logs");
const logPath = path.join(logsDir, "ci.log");

if (!fs.existsSync(logPath)) {
  console.error(`Log file not found at ${logPath}`);
  process.exit(1);
}

const logContent = fs.readFileSync(logPath, "utf-8");
// Simple extraction: lines containing 'error' or 'FAIL' (case-insensitive)
const errorLines = logContent
  .split(/\r?\n/)
  .filter((line) => /error|FAIL|failure|exception/i.test(line))
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (errorLines.length === 0) {
  console.log("No error lines detected in CI log.");
  process.exit(0);
}

// Group similar errors (naïve grouping by first 100 chars)
const groups: Record<string, number> = {};
errorLines.forEach((line) => {
  const key = line.slice(0, 100);
  groups[key] = (groups[key] || 0) + 1;
});

let report = "# CI Error Report\n\n";
report += `Found ${errorLines.length} error lines.\n\n`;
report += "## Unique Error Messages\n\n";
Object.entries(groups).forEach(([msg, count]) => {
  report += `- ${msg}${count > 1 ? ` (×${count})` : ""}\n`;
});

const reportPath = path.join(logsDir, "ci_error_report.md");
fs.writeFileSync(reportPath, report);
console.log(`CI error report written to ${reportPath}`);
