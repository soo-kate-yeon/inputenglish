// scripts/fetch_ci_logs.ts
import { config } from "dotenv";
import { createWriteStream } from "fs";
import path from "path";

config(); // load .env variables

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
const repo = process.env.GITHUB_REPO; // format owner/repo
const branch = process.env.GITHUB_BRANCH; // optional branch name

if (!token || !repo) {
  console.error(
    "Missing GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_REPO env variables",
  );
  process.exit(1);
}

// Dynamically import the MCP GitHub server client
import("@modelcontextprotocol/server-github")
  .then(({ GitHub }) => {
    const github = new GitHub({ token });
    const [owner, repoName] = repo.split("/");
    const params: any = {};
    if (branch) params.branch = branch;
    return github.actions.listWorkflowRunsForRepo(owner, repoName, params);
  })
  .then((runs: any) => {
    if (!runs?.workflow_runs?.length) {
      throw new Error("No workflow runs found");
    }
    // Find the most recent failed run
    const failedRun = runs.workflow_runs.find(
      (run: any) => run.conclusion === "failure",
    );
    if (!failedRun) {
      console.log("No failed workflow runs found");
      process.exit(0);
    }
    return failedRun.id;
  })
  .then((runId: number) => {
    const [owner, repoName] = (process.env.GITHUB_REPO as string).split("/");
    return import("@modelcontextprotocol/server-github").then(({ GitHub }) => {
      const github = new GitHub({
        token: process.env.GITHUB_PERSONAL_ACCESS_TOKEN as string,
      });
      return github.actions.downloadWorkflowRunLogs(owner, repoName, runId);
    });
  })
  .then((logBuffer: Buffer) => {
    const logsDir = path.resolve("ci-logs");
    const fs = require("fs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
    const logPath = path.join(logsDir, "ci.log");
    fs.writeFileSync(logPath, logBuffer);
    console.log(`CI log saved to ${logPath}`);
  })
  .catch((err) => {
    console.error("Error fetching CI logs:", err.message);
    process.exit(1);
  });
