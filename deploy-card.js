/**
 * 部署执勤卡片到网站首页
 *
 * 用法:
 *   node deploy-card.js MMDD                # 默认部署动画版
 *   node deploy-card.js MMDD --anim         # 显式动画版
 *   node deploy-card.js MMDD --original     # 原版
 *   node deploy-card.js MMDD --dry-run      # 预演：只打印将做什么，不提交
 *
 * 例如:
 *   node deploy-card.js 0623
 *   node deploy-card.js 0623 --original
 *
 * 流程:
 * 1. 定位源卡片（动画版 执勤卡片{MMDD}-anim.html / 原版 执勤卡片{MMDD}.html）
 * 2. 删除其他旧 duty-card-*.html（只保留最新一期）
 * 3. 复制源卡片 → duty-card-{MMDD}.html（仅在内容变化时写入）
 * 4. 更新 index.html 链接
 * 5. git commit（不推送，等用户审核后手动 push）
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// ===== 参数解析 =====
const args = process.argv.slice(2);
const mmdd = args.find(a => /^\d{4}$/.test(a));
const dryRun = args.includes('--dry-run');
// 默认动画版；--original 切换原版（--anim 显式指定动画版，与默认等价）
const version = args.includes('--original') ? 'original' : 'optimized';

if (!mmdd) {
  console.error('用法: node deploy-card.js MMDD [--anim|--original] [--dry-run]');
  console.error('例如: node deploy-card.js 0623');
  console.error('默认部署动画版；--original 部署原版；--dry-run 预演不提交');
  process.exit(1);
}

// 版本衍生信息：动画版源文件带 -anim 后缀，原版不带
const versionLabel = version === 'optimized' ? '动画版' : '原版';
const srcSuffix = version === 'optimized' ? '-anim' : '';
const versionTag = version === 'optimized' ? '（动画版）' : '（原版）';

const siteDir = __dirname;
const parentDir = path.dirname(siteDir);
const dstName = `duty-card-${mmdd}.html`;
const dstFile = path.join(siteDir, dstName);
const indexFile = path.join(siteDir, 'index.html');

if (dryRun) console.log('【预演模式】仅打印计划，不做任何改动\n');

// ===== 1. 定位源文件（output/MMDD/ 优先，根目录兜底）=====
const srcName = `执勤卡片${mmdd}${srcSuffix}.html`;
let srcFile = path.join(parentDir, 'output', mmdd, srcName);
if (!fs.existsSync(srcFile)) {
  const altSrc = path.join(parentDir, srcName);
  if (fs.existsSync(altSrc)) {
    srcFile = altSrc;
  } else {
    console.error(`错误: 找不到 ${versionLabel} 源文件 "${srcName}"`);
    console.error(`  尝试: ${srcFile}`);
    console.error(`  尝试: ${altSrc}`);
    console.error(`请先生成卡片: node run.js --card（选择 ${versionLabel}）`);
    process.exit(1);
  }
}
console.log(`版本: ${versionLabel} | 源文件: ${srcFile}`);

// ===== 2. 删除旧卡片（只保留最新一期）=====
const oldCards = fs.readdirSync(siteDir)
  .filter(f => /^duty-card-\d{4}\.html$/.test(f) && f !== dstName);
for (const f of oldCards) {
  if (dryRun) { console.log(`将删除旧卡片: ${f}`); continue; }
  fs.unlinkSync(path.join(siteDir, f));
  console.log(`已删除旧卡片: ${f}`);
}

// ===== 3. 复制新卡片（字节级检测变化，避免无谓写入）=====
const newContent = fs.readFileSync(srcFile);
const unchanged = fs.existsSync(dstFile) && fs.readFileSync(dstFile).equals(newContent);
if (unchanged) {
  console.log(`卡片未变化: ${dstName}（跳过复制）`);
} else if (dryRun) {
  console.log(`将复制: ${srcName} → ${dstName}`);
} else {
  fs.copyFileSync(srcFile, dstFile);
  console.log(`已复制: ${srcName} → ${dstName}`);
}

// ===== 4. 更新 index.html 链接 =====
const indexContent = fs.readFileSync(indexFile, 'utf-8');
const linkMatch = indexContent.match(/href="(duty-card-\d+\.html)"/);
if (!linkMatch) {
  console.warn('警告: 未在 index.html 找到 duty-card 链接，请手动检查');
} else if (linkMatch[1] === dstName) {
  console.log(`index.html 链接已指向 ${dstName}（无需更新）`);
} else if (dryRun) {
  console.log(`将更新 index.html 链接: ${linkMatch[1]} → ${dstName}`);
} else {
  const updated = indexContent.replace(/href="duty-card-\d+\.html"/, `href="${dstName}"`);
  fs.writeFileSync(indexFile, updated, 'utf-8');
  console.log(`已更新 index.html 链接: ${linkMatch[1]} → ${dstName}`);
}

// ===== 5. git commit（不推送；无改动则跳过）=====
if (dryRun) {
  console.log('\n【预演完成】未做任何改动，未提交。');
  process.exit(0);
}

try {
  execSync('git add -A', { cwd: siteDir, stdio: 'pipe' });

  // git diff --cached --quiet: 退出码 0=无暂存改动, 1=有改动
  let hasStaged = true;
  try {
    execSync('git diff --cached --quiet', { cwd: siteDir, stdio: 'pipe' });
    hasStaged = false;
  } catch (_) {
    hasStaged = true;
  }

  if (!hasStaged) {
    console.log('\n无改动，跳过 git commit。');
  } else {
    // 用 -F 临时文件传 message，规避 Windows 命令行中文编码问题
    const msgFile = path.join(os.tmpdir(), `deploy-msg-${mmdd}-${Date.now()}.txt`);
    fs.writeFileSync(msgFile, `deploy: 更新执勤卡片 ${mmdd}${versionTag}\n`, 'utf-8');
    execSync(`git commit -F "${msgFile}"`, { cwd: siteDir, stdio: 'inherit' });
    fs.unlinkSync(msgFile);
    console.log(`\n已提交: deploy: 更新执勤卡片 ${mmdd}${versionTag}`);
    console.log('请审核后手动运行: git push');
  }
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString() : '';
  console.error('\ngit 操作失败:');
  if (stderr) console.error(stderr.trim());
  console.error(err.message);
  process.exit(1);
}
