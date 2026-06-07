import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "manifest.json"), "utf8"));
const packageName = `click-faster-${manifest.version}`;
const distDir = path.join(rootDir, "dist");
const buildDir = path.join(distDir, packageName);
const devZip = path.join(distDir, `${packageName}-dev.zip`);
const storeZip = path.join(distDir, `${packageName}-store.zip`);
const releaseFiles = [
  "manifest.json",
  "content.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "options.html",
  "icons"
];

fs.mkdirSync(distDir, { recursive: true });
fs.rmSync(buildDir, { recursive: true, force: true });
fs.rmSync(devZip, { force: true });
fs.rmSync(storeZip, { force: true });
fs.mkdirSync(buildDir, { recursive: true });

for (const filePath of releaseFiles) {
  const source = path.join(rootDir, filePath);
  const target = path.join(buildDir, filePath);
  fs.cpSync(source, target, { recursive: true });
}

runZip(distDir, devZip, [packageName]);
runZip(buildDir, storeZip, releaseFiles);

console.log(`개발자 모드용 패키지: ${path.relative(rootDir, devZip)}`);
console.log(`스토어 업로드용 패키지: ${path.relative(rootDir, storeZip)}`);

function runZip(cwd, zipPath, entries) {
  const result = spawnSync("zip", ["-qr", zipPath, ...entries], {
    cwd,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("ZIP 패키지 생성에 실패했습니다.");
  }
}
