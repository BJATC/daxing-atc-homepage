/**
 * 部署执勤卡片到网站首页
 * 用法: node deploy-card.js MMDD
 * 例如: node deploy-card.js 0528
 *
 * 流程:
 * 1. 复制 执勤卡片{MMDD}.html → 网站首页/duty-card-{MMDD}.html
 * 2. 更新 index.html 中的链接
 * 3. git commit（不推送，等用户审核后手动 push）
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const mmdd = process.argv[2];
if (!mmdd || !/^\d{4}$/.test(mmdd)) {
  console.error('用法: node deploy-card.js MMDD');
  console.error('例如: node deploy-card.js 0528');
  process.exit(1);
}

const siteDir = __dirname;
const parentDir = path.dirname(siteDir);

const srcFile = path.join(parentDir, `执勤卡片${mmdd}.html`);
const dstFile = path.join(siteDir, `duty-card-${mmdd}.html`);
const indexFile = path.join(siteDir, 'index.html');

// 检查源文件是否存在
if (!fs.existsSync(srcFile)) {
  console.error(`错误: 找不到文件 ${srcFile}`);
  process.exit(1);
}

// 复制卡片文件
fs.copyFileSync(srcFile, dstFile);
console.log(`已复制: ${path.basename(srcFile)} → ${path.basename(dstFile)}`);

// 更新 index.html 中的链接
let indexContent = fs.readFileSync(indexFile, 'utf-8');
const oldLink = indexContent.match(/href="duty-card-\d+\.html"/);
if (oldLink) {
  const newHref = `duty-card-${mmdd}.html`;
  indexContent = indexContent.replace(/href="duty-card-\d+\.html"/, `href="${newHref}"`);
  fs.writeFileSync(indexFile, indexContent, 'utf-8');
  console.log(`已更新 index.html 链接 → ${newHref}`);
} else {
  console.warn('警告: 未找到 index.html 中的卡片链接，请手动检查');
}

// git commit（不推送）
execSync(`git add index.html duty-card-${mmdd}.html`, { cwd: siteDir });
execSync(`git commit -m "deploy: 更新执勤卡片 ${mmdd}"`, { cwd: siteDir });
console.log('\n已提交到本地 git。');
console.log('请审核后手动运行: git push');
