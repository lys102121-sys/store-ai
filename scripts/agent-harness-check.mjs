import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/harness.json",
  ".agents/project/context.md",
  ".agents/project/status.md",
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

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(projectRoot, file)), `Missing ${file}`);
}

const harness = JSON.parse(readProjectFile(".agents/harness.json"));
const packageJson = JSON.parse(readProjectFile("package.json"));
const agentRules = readProjectFile("AGENTS.md");
const context = readProjectFile(".agents/project/context.md");
const status = readProjectFile(".agents/project/status.md");
const preflight = readProjectFile(".agents/commands/preflight.md");
const verify = readProjectFile(".agents/commands/verify.md");
const commitPush = readProjectFile(".agents/commands/commit-push.md");

for (const scriptName of harness.requiredPackageScripts) {
  assert(
    packageJson.scripts?.[scriptName],
    `package.json is missing script "${scriptName}"`,
  );
}

const requiredAgentRulePatterns = [
  /Next\.js|Next/,
  /\.agents\/project\/context\.md/,
  /\.agents\/project\/status\.md/,
  /중복/,
  /커밋.*푸시|푸시.*커밋/s,
  /test:cs-guard/,
];

for (const pattern of requiredAgentRulePatterns) {
  assert(pattern.test(agentRules), `AGENTS.md is missing pattern ${pattern}`);
}

const requiredContextPatterns = [
  /AI CS 직원/,
  /돈이 벌리는 서비스/,
  /추측하지 않는다/,
  /Self-verification loop/,
  /Context map/,
];

for (const pattern of requiredContextPatterns) {
  assert(pattern.test(context), `context.md is missing pattern ${pattern}`);
}

const requiredStatusPatterns = [
  /이미 진행됨/,
  /일부 진행됨/,
  /다음 후보/,
  /쿠팡/,
  /스마트스토어/,
  /missing info/,
  /사장님 수정 답변 학습/,
];

for (const pattern of requiredStatusPatterns) {
  assert(pattern.test(status), `status.md is missing pattern ${pattern}`);
}

assert(/관련 키워드로 코드 검색/.test(preflight), "preflight checklist is incomplete");
assert(/npm run test:cs-guard/.test(verify), "verify command list is incomplete");
assert(/git push/.test(commitPush), "commit/push policy is incomplete");

console.log("Agent harness check passed.");

