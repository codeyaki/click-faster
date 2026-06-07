const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rootDir = path.resolve(__dirname, "..");

function loadContentHelpers(hostname = "example.com") {
  const helpers = {};
  const context = {
    __CLICK_FASTER_TEST__: helpers,
    browser: null,
    chrome: null,
    clearTimeout,
    console,
    Date,
    document: {
      addEventListener() {},
      body: { append() {} },
      documentElement: { append() {} },
      elementFromPoint() {
        return null;
      },
      querySelectorAll() {
        return [];
      }
    },
    globalThis: null,
    innerHeight: 768,
    innerWidth: 1024,
    location: { hostname },
    setTimeout
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(rootDir, "content.js"), "utf8"), context);

  return helpers;
}

test("넷플릭스에서는 호환 모드가 요청 배속을 1.5배속으로 제한한다", () => {
  const helpers = loadContentHelpers("www.netflix.com");

  assert.equal(helpers.getEffectiveSpeed({ speed: 2, compatibilityMode: true }, "www.netflix.com"), 1.5);
  assert.equal(helpers.getEffectiveSpeed({ speed: 1.25, compatibilityMode: true }, "netflix.com"), 1.25);
});

test("호환 모드를 끄면 넷플릭스에서도 요청 배속을 사용한다", () => {
  const helpers = loadContentHelpers("www.netflix.com");

  assert.equal(helpers.getEffectiveSpeed({ speed: 2, compatibilityMode: false }, "www.netflix.com"), 2);
});

test("현재 사이트 제외 목록은 www와 하위 도메인을 같은 도메인으로 처리한다", () => {
  const helpers = loadContentHelpers("www.netflix.com");

  assert.equal(helpers.normalizeHost("www.Netflix.com."), "netflix.com");
  assert.equal(helpers.isHostDisabled("www.netflix.com", ["netflix.com"]), true);
  assert.equal(helpers.isHostDisabled("movies.netflix.com", ["netflix.com"]), true);
  assert.equal(helpers.isHostDisabled("example.com", ["netflix.com"]), false);
});
