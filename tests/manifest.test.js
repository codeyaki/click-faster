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
  assert.equal(manifest.homepage_url, "https://github.com/codeyaki/click-faster");
});

test("모든 URL과 모든 프레임에 콘텐츠 스크립트를 주입한다", () => {
  assert.deepEqual(manifest.host_permissions, ["<all_urls>"]);
  assert.equal(manifest.content_scripts.length, 1);
  assert.deepEqual(manifest.content_scripts[0].matches, ["<all_urls>"]);
  assert.deepEqual(manifest.content_scripts[0].js, ["content.js"]);
  assert.equal(manifest.content_scripts[0].all_frames, true);
});

test("필요한 확장 권한을 포함한다", () => {
  assert.ok(manifest.permissions.includes("activeTab"));
  assert.ok(manifest.permissions.includes("storage"));
});

test("브라우저와 스토어용 PNG 아이콘을 포함한다", () => {
  const iconSizes = ["16", "32", "48", "128"];

  for (const size of iconSizes) {
    assert.equal(manifest.icons[size], `icons/icon-${size}.png`);
    assert.equal(manifest.action.default_icon[size], `icons/icon-${size}.png`);
    assert.ok(fs.existsSync(path.join(rootDir, manifest.icons[size])));
  }
});
