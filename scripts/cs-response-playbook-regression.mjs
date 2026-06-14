import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csResponsePlaybook.ts");
const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { exports: {}, console };

vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

const prompt = sandbox.exports.buildCsResponsePlaybookPrompt();

assert.match(prompt, /필요한 최소 정보만 요청/);
assert.match(prompt, /접수됨, 확인 중, 처리 진행 중, 완료를 구분/);
assert.match(prompt, /결과나 일정을 약속하지 마세요/);
assert.match(prompt, /개인정보를 한꺼번에 요구하지 마세요/);
assert.match(prompt, /가게 정보에 해당 접수 경로나 연락 방법이 명시/);
assert.match(prompt, /리뷰 요청, 구매 유도, 홍보 문구/);

console.log("CS response playbook regression tests passed.");
