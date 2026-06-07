const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "manifest.json"), "utf8"));

test("Manifest V3 확장으로 구성되어 있다", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.options_ui.page, "options.html");
});

test("모든 URL과 모든 프레임에 콘텐츠 스크립트를 주입한다", () => {
  assert.deepEqual(manifest.host_permissions, ["<all_urls>"]);
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ["<all_urls>"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["content.js"]);
  assert.equal(manifest.content_scripts[0].all_frames, true);
});

test("설정 저장 권한을 포함한다", () => {
  assert.ok(manifest.permissions.includes("storage"));
});
