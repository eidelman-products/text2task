#!/usr/bin/env node
import { runIndexNowSubmission } from "./indexnow-submitter.mjs";

function parseArgs(argv) {
  const options = {
    submit: false,
    urls: [],
    files: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--submit") {
      options.submit = true;
      continue;
    }

    if (arg === "--url") {
      options.urls.push(requiredValue(argv, (index += 1), "--url"));
      continue;
    }

    if (arg === "--file") {
      options.files.push(requiredValue(argv, (index += 1), "--file"));
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printHelp() {
  console.log(`Usage:
  npm run indexnow -- --url /features/email-to-tasks
  npm run indexnow -- --file app/features/email-to-tasks/page.tsx
  npm run indexnow -- --submit --url /features/email-to-tasks

Default mode is dry-run. A real IndexNow request requires --submit.`);
}

try {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const report = await runIndexNowSubmission(options);
  console.log(JSON.stringify(report, null, 2));

  if (
    options.submit &&
    !["SUBMISSION_ACCEPTED"].includes(report.overallResult)
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        mode: "error",
        overallResult: "CLI_ERROR",
        error: error instanceof Error ? error.message : "Unknown CLI error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
