import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csResponsePlaybook.ts");
const escalationPath = path.join(
  projectRoot,
  "app/lib/csServiceEscalation.ts",
);
const escalationSource = fs.readFileSync(escalationPath, "utf8");
const escalationTranspiled = ts.transpileModule(escalationSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const escalationSandbox = { exports: {}, console };

vm.runInNewContext(escalationTranspiled, escalationSandbox, {
  filename: escalationPath,
});

const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = {
  exports: {},
  require(specifier) {
    if (specifier.includes("csServiceEscalation")) {
      return escalationSandbox.exports;
    }
    return {};
  },
  console,
};

vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

const prompt = sandbox.exports.buildCsResponsePlaybookPrompt();

assert.match(prompt, /필요한 최소 정보만 요청/);
assert.match(prompt, /접수됨, 확인 중, 처리 진행 중, 완료를 구분/);
assert.match(prompt, /결과나 일정을 약속하지 마세요/);
assert.match(prompt, /개인정보를 한꺼번에 요구하지 마세요/);
assert.match(prompt, /어떤 증상을 확인하기 위해 필요한지/);
assert.match(prompt, /촬영이나 파일 전송이 어렵다고 하면/);
assert.match(prompt, /과거 응대 예시나 다른 고객 사례/);
assert.match(prompt, /현재 가게 정보에 명시된 값만 사용/);
assert.match(prompt, /정보 문의, 주문 변경, 배송, 고장·불량/);
assert.match(prompt, /현재 단계에서 꼭 필요한 다음 행동/);
assert.match(prompt, /요청 접수, 상품 회수, 검수, 결제 취소, 환불 완료/);
assert.match(prompt, /회수 누락이나 배송 지연/);
assert.match(prompt, /가게 정보에 해당 접수 경로나 연락 방법이 명시/);
assert.match(prompt, /리뷰 요청, 구매 유도, 홍보 문구/);
assert.match(prompt, /반복 문제와 서비스 실패 우선 처리/);

console.log("CS response playbook regression tests passed.");
