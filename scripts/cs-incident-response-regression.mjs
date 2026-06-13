import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "app/lib/csIncidentResponse.ts");

const source = fs.readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const sandbox = { exports: {}, console };

vm.runInNewContext(transpiled, sandbox, { filename: sourcePath });

const { buildProductSafetyReply, buildProductSafetyReviewReply } =
  sandbox.exports;
const reply = buildProductSafetyReply({ store_name: "테스트 상점" });

assert.match(reply, /제품 사용과 충전을 중단/);
assert.match(reply, /상품명과 증상 발생 시점/);
assert.match(reply, /사진이나 영상/);
assert.doesNotMatch(reply, /제품 불량|고객 과실|정상 범위|외부 환경 때문/);

const reviewReply = buildProductSafetyReviewReply();

assert.match(reviewReply, /제품 사용과 충전을 중단/);
assert.match(reviewReply, /주문 정보와 함께 문의/);
assert.doesNotMatch(reviewReply, /이름|연락처|주소|제품 불량|고객 과실/);

console.log("CS incident response regression tests passed.");
