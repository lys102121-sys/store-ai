import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/harness.json",
  ".agents/project/context.md",
  ".agents/project/status.md",
  ".agents/project/moai-adk.md",
  ".agents/commands/preflight.md",
  ".agents/commands/verify.md",
  ".agents/commands/commit-push.md",
];

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertMatches(source, patterns, label) {
  for (const pattern of patterns) {
    assert(pattern.test(source), `${label} is missing pattern ${pattern}`);
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(projectRoot, file)), `Missing ${file}`);
}

const harness = JSON.parse(readProjectFile(".agents/harness.json"));
const packageJson = JSON.parse(readProjectFile("package.json"));
const agentRules = readProjectFile("AGENTS.md");
const context = readProjectFile(".agents/project/context.md");
const status = readProjectFile(".agents/project/status.md");
const moaiAdk = readProjectFile(".agents/project/moai-adk.md");
const preflight = readProjectFile(".agents/commands/preflight.md");
const verify = readProjectFile(".agents/commands/verify.md");
const commitPush = readProjectFile(".agents/commands/commit-push.md");

for (const scriptName of harness.requiredPackageScripts) {
  assert(
    packageJson.scripts?.[scriptName],
    `package.json is missing script "${scriptName}"`,
  );
}

assertMatches(
  agentRules,
  [
    /Next\.js/,
    /\.agents\/project\/context\.md/,
    /\.agents\/project\/status\.md/,
    /\.agents\/project\/moai-adk\.md/,
    /Manager, Expert, and Builder/,
    /test:cs-guard/,
    /paid-adoption/,
  ],
  "AGENTS.md",
);

assertMatches(
  context,
  [
    /AI CS employee/,
    /Paid-first product/,
    /Manager Agent/,
    /Expert Agent/,
    /Builder Agent/,
    /Context map/,
    /Self-verification loop/,
    /Session persistence/,
    /Failure checklist/,
    /Language independence/,
    /Garbage collection/,
    /Scaffold-first work/,
  ],
  "context.md",
);

assertMatches(
  status,
  [
    /Implemented/,
    /Remaining Gaps/,
    /Current Priorities/,
    /Paid-first public journey/,
    /Coupang/,
    /Smartstore/,
    /missing-info learning/i,
    /payment\/subscription/,
  ],
  "status.md",
);

assertMatches(
  moaiAdk,
  [
    /Manager Agent/,
    /Expert Agent/,
    /Builder Agent/,
    /Context Map/,
    /Self-Verification Loop/,
    /Session Persistence/,
    /Failure Checklist/,
    /Language Independence/,
    /Garbage Collection/,
    /Scaffold First/,
    /Default Routing Table/,
  ],
  "moai-adk.md",
);

const requiredHarnessRoles = ["Manager Agent", "Expert Agent", "Builder Agent"];
for (const role of requiredHarnessRoles) {
  assert(harness.agentRoles?.includes(role), `harness.json is missing ${role}`);
}

const requiredHarnessPrinciples = [
  "Context map",
  "Self-verification loop",
  "Session persistence",
  "Failure checklist",
  "Language independence",
  "Garbage collection",
  "Scaffold-first work",
];

for (const principle of requiredHarnessPrinciples) {
  assert(
    harness.moaiAdkPrinciples?.includes(principle),
    `harness.json is missing ${principle}`,
  );
}

assertMatches(
  preflight,
  [
    /Read `AGENTS\.md`/,
    /moai-adk\.md/,
    /Search existing implementation/,
    /Manager/,
    /Expert/,
    /Builder/,
    /garbage-collected/,
  ],
  "preflight checklist",
);

assertMatches(
  verify,
  [
    /npm run test:harness/,
    /npm run test:cs-guard/,
    /npm run test:monetization/,
    /npm run test:workflow-safety/,
    /npm run build/,
  ],
  "verify command list",
);

assertMatches(
  commitPush,
  [
    /Commit And Push Policy/,
    /Push immediately/,
    /next task plus the task after that/,
    /Do not revert user changes/,
  ],
  "commit/push policy",
);

console.log("Agent harness check passed.");
