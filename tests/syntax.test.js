const { execFileSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

const rootDir = path.resolve(__dirname, "..");

for (const fileName of ["content.js", "popup.js"]) {
  test(`${fileName} 문법이 유효하다`, () => {
    execFileSync(process.execPath, ["--check", path.join(rootDir, fileName)], {
      stdio: "pipe"
    });
  });
}
