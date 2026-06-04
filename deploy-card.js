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

let srcFile = path.join(parentDir, 'output', mmdd, `执勤卡片${mmdd}.html`);
const dstFile = path.join(siteDir, `duty-card-${mmdd}.html`);
const indexFile = path.join(siteDir, 'index.html');

// 检查源文件是否存在（兼容从 output/ 或根目录查找）
if (!fs.existsSync(srcFile)) {
  const altSrc = path.join(parentDir, `执勤卡片${mmdd}.html`);
  if (fs.existsSync(altSrc)) {
    srcFile = altSrc;
  } else {
    console.error('错误: 找不到文件');
    console.error('  尝试: ' + srcFile);
    console.error('  尝试: ' + altSrc);
    process.exit(1);
  }
}

// 删除旧卡片（只保留最新的）
const oldCards = fs.readdirSync(siteDir).filter(f => /^duty-card-\d{4}\.html$/.test(f) && f !== `duty-card-${mmdd}.html`);
oldCards.forEach(f => {
  fs.unlinkSync(path.join(siteDir, f));
  console.log('已删除旧卡片: ' + f);
});

// 复制新卡片
fs.copyFileSync(srcFile, dstFile);
console.log('已复制: ' + path.basename(srcFile) + ' → ' + path.basename(dstFile));

// 更新 index.html 中的链接
let indexContent = fs.readFileSync(indexFile, 'utf-8');
const oldLink = indexContent.match(/href="duty-card-\d+\.html"/);
if (oldLink) {
  const newHref = `duty-card-${mmdd}.html`;
  indexContent = indexContent.replace(/href="duty-card-\d+\.html"/, `href="${newHref}"`);
  fs.writeFileSync(indexFile, indexContent, 'utf-8');
  console.log('已更新 index.html 链接 → ' + newHref);
} else {
  console.warn('警告: 未找到 index.html 中的卡片链接，请手动检查');
}

// git commit（不推送）
execSync('git add -A', { cwd: siteDir });
execSync('git commit -m "deploy: 更新执勤卡片 ' + mmdd + '"', { cwd: siteDir });
console.log('\n已提交到本地 git。');
console.log('请审核后手动运行: git push');
