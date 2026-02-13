/**
 * Pre-commit secret & PII scanner.
 *
 * Scans staged git diffs for API keys, tokens, private keys, connection
 * strings, and other sensitive patterns. Exits non-zero to block the commit
 * if anything is found.
 *
 * Run manually:  node frontend/scripts/check-secrets.js
 * Runs automatically via husky pre-commit hook.
 */

const { execSync } = require("child_process");
const path = require("path");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Files/paths to skip entirely (glob-style prefixes or exact matches). */
const SKIP_PATHS = [
  "package-lock.json",
  "node_modules/",
  ".ico",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
];

/** The scanner itself is allowlisted — patterns in this file are definitions, not leaks. */
const SELF_PATH = "frontend/scripts/check-secrets.js";

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

/**
 * Each entry: { name, regex, description }
 * regex is tested against individual added lines from the staged diff.
 */
const SECRET_PATTERNS = [
  {
    name: "Anthropic API key",
    regex: /sk-ant-api\d{2}-[A-Za-z0-9_-]{20,}/,
    description: "Possible Anthropic API key",
  },
  {
    name: "Generic secret key",
    regex: /sk-[A-Za-z0-9]{32,}/,
    description: "Possible secret key (sk-...)",
  },
  {
    name: "Google API key",
    regex: /AIza[0-9A-Za-z_-]{35}/,
    description: "Possible Google API key",
  },
  {
    name: "GitHub token",
    regex: /gh[pos]_[A-Za-z0-9_]{36,}/,
    description: "Possible GitHub token",
  },
  {
    name: "AWS access key",
    regex: /AKIA[0-9A-Z]{16}/,
    description: "Possible AWS access key ID",
  },
  {
    name: "Slack token",
    regex: /xox[bpoas]-[A-Za-z0-9-]+/,
    description: "Possible Slack token",
  },
  {
    name: "JWT / Supabase key",
    regex: /eyJ[A-Za-z0-9_=-]{20,}\.eyJ[A-Za-z0-9_=-]{20,}\.[A-Za-z0-9_.=-]{20,}/,
    description: "Possible JWT or Supabase service key",
  },
  {
    name: "Private key",
    regex: /-----BEGIN.*PRIVATE KEY-----/,
    description: "Private key block detected",
  },
  {
    name: "Connection string",
    regex: /(postgres|mysql|mongodb|redis):\/\/[^/\s]+:[^/\s]+@/,
    description: "Connection string with embedded credentials",
  },
  {
    name: "IP:port endpoint",
    regex: /\d+\.\d+\.\d+\.\d+:\d{4,}/,
    description: "Hardcoded IP:port endpoint",
  },
  {
    name: "Hardcoded secret value",
    regex: /(SECRET|KEY|TOKEN|PASSWORD)\s*=\s*['"][A-Za-z0-9+/=_-]{20,}['"]/,
    description: "Hardcoded secret assignment",
  },
];

// ---------------------------------------------------------------------------
// Allowlist helpers
// ---------------------------------------------------------------------------

function shouldSkipFile(filePath) {
  // Self-allowlist
  if (filePath === SELF_PATH || filePath.endsWith("check-secrets.js")) {
    return true;
  }
  for (const pattern of SKIP_PATHS) {
    if (filePath.endsWith(pattern) || filePath.includes(pattern)) {
      return true;
    }
  }
  return false;
}

function shouldSkipLine(line) {
  // process.env.VARIABLE references (reading a name, not a value)
  if (/process\.env\.[A-Z_]+/.test(line) && !/'[^']{20,}'|"[^"]{20,}"/.test(line)) {
    return true;
  }
  // Placeholder values in .env.example
  if (/your[-_]/.test(line) || /=\s*$/.test(line) || /=\s*["']\s*["']/.test(line)) {
    return true;
  }
  // Markdown table rows and inline code showing example patterns (docs)
  if (/^\s*\|.*\|/.test(line)) {
    return true;
  }
  // Markdown inline code backticks showing pattern examples
  if (/`[^`]*`/.test(line) && !/['"]\s*$/.test(line)) {
    const stripped = line.replace(/`[^`]*`/g, "");
    // If removing the backtick content eliminates the match, it's just documentation
    let anyMatch = false;
    for (const p of SECRET_PATTERNS) {
      if (p.regex.test(stripped)) {
        anyMatch = true;
        break;
      }
    }
    if (!anyMatch && SECRET_PATTERNS.some((p) => p.regex.test(line))) {
      return true;
    }
  }
  // Fenced code blocks in markdown that show example commands (e.g., ```bash)
  if (/^\s*```/.test(line)) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Blocked file patterns (entire files that should never be committed)
// ---------------------------------------------------------------------------

function isBlockedEnvFile(filePath) {
  const base = path.basename(filePath);
  // Block .env files but allow .env.example
  if (base.startsWith(".env") && !base.includes("example")) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main scanner
// ---------------------------------------------------------------------------

function getStagedFiles() {
  try {
    const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf-8",
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function getStagedDiff(filePath) {
  try {
    return execSync(`git diff --cached -- "${filePath}"`, {
      encoding: "utf-8",
    });
  } catch {
    return "";
  }
}

function scanDiff(filePath, diff) {
  const findings = [];
  const lines = diff.split("\n");
  let lineNum = 0;

  for (const line of lines) {
    // Track line numbers from diff hunk headers
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunkMatch) {
      lineNum = parseInt(hunkMatch[1], 10) - 1;
      continue;
    }

    // Only scan added lines
    if (!line.startsWith("+") || line.startsWith("+++")) {
      if (!line.startsWith("-")) lineNum++;
      continue;
    }
    lineNum++;

    const content = line.slice(1); // Remove the leading "+"

    if (shouldSkipLine(content)) continue;

    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        // Truncate the match for display
        const match = content.match(pattern.regex);
        const snippet = match
          ? match[0].length > 40
            ? match[0].slice(0, 37) + "..."
            : match[0]
          : content.trim().slice(0, 40);

        findings.push({
          file: filePath,
          line: lineNum,
          pattern: pattern.name,
          description: pattern.description,
          snippet,
        });
        break; // One finding per line is enough
      }
    }
  }

  return findings;
}

function main() {
  const files = getStagedFiles();
  if (files.length === 0) return;

  const allFindings = [];

  for (const filePath of files) {
    // Check for blocked .env files
    if (isBlockedEnvFile(filePath)) {
      allFindings.push({
        file: filePath,
        line: null,
        pattern: "Blocked file",
        description: ".env files must not be committed (use .env.example)",
        snippet: null,
      });
      continue;
    }

    // Skip binary/allowlisted files
    if (shouldSkipFile(filePath)) continue;

    // Scan the diff
    const diff = getStagedDiff(filePath);
    if (!diff) continue;

    const findings = scanDiff(filePath, diff);
    allFindings.push(...findings);
  }

  if (allFindings.length === 0) return;

  // Print report
  console.error("");
  console.error(" Secret scan failed \u2014 commit blocked");
  console.error("");

  // Group by file
  const byFile = {};
  for (const f of allFindings) {
    if (!byFile[f.file]) byFile[f.file] = [];
    byFile[f.file].push(f);
  }

  for (const [file, findings] of Object.entries(byFile)) {
    console.error(`  ${file}`);
    for (const f of findings) {
      if (f.line) {
        console.error(`    Line ${f.line}: [${f.pattern}] ${f.description}`);
        console.error(`             ${f.snippet}`);
      } else {
        console.error(`    [${f.pattern}] ${f.description}`);
      }
    }
    console.error("");
  }

  console.error(" Fix the issues above, then try committing again.");
  console.error(" To bypass this check (emergency only): git commit --no-verify");
  console.error("");

  process.exit(1);
}

main();
