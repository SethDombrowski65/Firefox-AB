#!/usr/bin/env node

import { execSync } from 'child_process';
import { rmSync, existsSync, cpSync, readdirSync, statSync, mkdirSync, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const browsersDir = path.join(__dirname, 'browsers');
const distDir = path.join(__dirname, 'dist');
const pluginsDir = path.join(__dirname, 'plugins');
const srcPluginsDir = path.join(__dirname, 'plugins');

const browsersArg = process.argv.find(arg => arg.startsWith('--browsers='));
const browsersType = browsersArg ? browsersArg.split('=')[1] : 'both';

if (!['chromium', 'firefox', 'both'].includes(browsersType)) {
  console.error('错误: --browsers 参数必须是 chromium, firefox 或 both');
  process.exit(1);
}

const targetPlatform = process.argv[2] || process.platform;
const isWindows = targetPlatform === 'win32' || process.platform === 'win32';

const cacheDir = isWindows
  ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'ms-playwright')
  : path.join(os.homedir(), '.cache', 'ms-playwright');

console.log(`开始构建\n`);
console.log(`平台: ${isWindows ? 'Windows' : 'Linux'}`);
console.log(`浏览器类型: ${browsersType}`);
console.log(`缓存目录: ${cacheDir}\n`);

(async () => {
try {
  if (isWindows && existsSync(path.join(distDir, 'win-unpacked'))) {
    rmSync(path.join(distDir, 'win-unpacked'), { recursive: true, force: true });
  }
  if (!isWindows && existsSync(path.join(distDir, 'linux-unpacked'))) {
    rmSync(path.join(distDir, 'linux-unpacked'), { recursive: true, force: true });
  }

  console.log('步骤0: 准备插件目录');
  const pluginsChromeDir = path.join(pluginsDir, 'chrome');
  const pluginsFirefoxDir = path.join(pluginsDir, 'firefox');
  
  mkdirSync(pluginsChromeDir, { recursive: true });
  mkdirSync(pluginsFirefoxDir, { recursive: true });
  console.log('✓ 插件目录已创建\n');

  console.log('步骤1: 下载浏览器');
  try {
    const installCmd = browsersType === 'both' 
      ? 'npx playwright install chromium firefox'
      : `npx playwright install ${browsersType}`;
    execSync(installCmd, { stdio: 'inherit' });
  } catch (error) {
    console.error('浏览器下载失败:', error.message);
    throw new Error('浏览器下载失败，无法继续构建');
  }
  
  const cachedFiles = readdirSync(cacheDir);
  const chromiumDir = cachedFiles.find(f => f.startsWith('chromium-'));
  const firefoxDir = cachedFiles.find(f => f.startsWith('firefox-'));
  
  if ((browsersType === 'chromium' || browsersType === 'both') && !chromiumDir) {
    throw new Error(`Chromium 未下载`);
  }
  if ((browsersType === 'firefox' || browsersType === 'both') && !firefoxDir) {
    throw new Error(`Firefox 未下载`);
  }
  
  if (chromiumDir) {
    console.log(`✓ Chromium: ${chromiumDir}`);
  }
  if (firefoxDir) {
    console.log(`✓ Firefox: ${firefoxDir}`);
  }
  console.log('');

  console.log('步骤2: 复制浏览器到项目');
  if (existsSync(browsersDir)) {
    rmSync(browsersDir, { recursive: true, force: true });
  }
  mkdirSync(browsersDir, { recursive: true });
  
  try {
    if (browsersType === 'chromium' || browsersType === 'both') {
      if (chromiumDir) {
        const srcPath = path.join(cacheDir, chromiumDir);
        const dstPath = path.join(browsersDir, chromiumDir);
        cpSync(srcPath, dstPath, { recursive: true });
        console.log(`✓ Chromium 已复制`);
      }
    }
    
    if (browsersType === 'firefox' || browsersType === 'both') {
      if (firefoxDir) {
        const srcPath = path.join(cacheDir, firefoxDir);
        const dstPath = path.join(browsersDir, firefoxDir);
        cpSync(srcPath, dstPath, { recursive: true });
        console.log(`✓ Firefox 已复制`);
      }
    }
  } catch (error) {
    console.error('浏览器复制失败:', error.message);
    throw new Error('浏览器复制失败，无法继续构建');
  }
  
  const builtFiles = readdirSync(browsersDir);
  const builtChromiumBrowserDir = builtFiles.find(f => f.startsWith('chromium-'));
  const builtFirefoxBrowserDir = builtFiles.find(f => f.startsWith('firefox-'));
  
  if ((browsersType === 'chromium' || browsersType === 'both') && !builtChromiumBrowserDir) {
    throw new Error(`浏览器复制不完整: 找不到 Chromium`);
  }
  if ((browsersType === 'firefox' || browsersType === 'both') && !builtFirefoxBrowserDir) {
    throw new Error(`浏览器复制不完整: 找不到 Firefox`);
  }
  
  console.log(`✓ 浏览器复制完成\n`);

  console.log('步骤3: 打包应用');
  const unpackedDir = isWindows 
    ? path.join(distDir, 'win-unpacked')
    : path.join(distDir, 'linux-unpacked');
  
  if (existsSync(unpackedDir)) {
    rmSync(unpackedDir, { recursive: true, force: true });
  }
  mkdirSync(unpackedDir, { recursive: true });
  
  console.log('复制项目文件...');
  cpSync(path.join(__dirname, 'src'), path.join(unpackedDir, 'src'), { recursive: true });
  cpSync(path.join(__dirname, 'node_modules'), path.join(unpackedDir, 'node_modules'), { recursive: true });
  cpSync(path.join(__dirname, 'package.json'), path.join(unpackedDir, 'package.json'));
  cpSync(browsersDir, path.join(unpackedDir, 'browsers'), { recursive: true });
  cpSync(pluginsDir, path.join(unpackedDir, 'plugins'), { recursive: true });
  
  if (isWindows) {
    cpSync(path.join(__dirname, 'start.bat'), path.join(unpackedDir, 'start.bat'));
  } else {
    cpSync(path.join(__dirname, 'start.sh'), path.join(unpackedDir, 'start.sh'));
    execSync(`chmod +x ${path.join(unpackedDir, 'start.sh')}`);
  }
  
  console.log('✓ 项目文件已复制\n');

  console.log('步骤4: 打包');
  
  const browserSuffix = browsersType === 'chromium' ? 'Chromium' : 
                        browsersType === 'firefox' ? 'Firefox' : 'Both';
  const platformName = isWindows ? 'Windows' : 'Linux';
  const outFileName = `Browser-Manager-${platformName}-${browserSuffix}-1.0.0.zip`;
  const zipPath = path.join(distDir, outFileName);
  
  if (existsSync(zipPath)) {
    rmSync(zipPath);
  }
  
  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(zipPath);
    
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      
      const dirName = isWindows ? 'win-unpacked' : 'linux-unpacked';
      archive.directory(unpackedDir, dirName);
      archive.finalize();
    });
    
    if (!existsSync(zipPath)) {
      throw new Error('ZIP文件未生成');
    }
    const stats = statSync(zipPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`✓ 已打包: ${outFileName} (${sizeMB}MB)\n`);
  } catch (error) {
    console.error('打包失败:', error.message);
    throw new Error(`打包失败: ${error.message}`);
  }

  console.log('步骤5: 清理临时文件');
  if (existsSync(browsersDir)) {
    rmSync(browsersDir, { recursive: true, force: true });
    console.log('✓ 浏览器缓存已清理');
  }
  console.log('');

  console.log('========================================');
  console.log('构建完成');
  console.log('========================================\n');
  console.log('输出文件:\n');
  
  if (!existsSync(distDir)) {
    throw new Error('dist 目录未创建');
  }
  
  const files = readdirSync(distDir);
  const outputFiles = files.filter(f => f.endsWith('.zip'));
  
  if (outputFiles.length === 0) {
    throw new Error('未生成任何 ZIP 文件');
  }
  
  outputFiles.forEach(f => {
    const fullPath = path.join(distDir, f);
    const stats = statSync(fullPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`  ✓ ${f}`);
    console.log(`    大小: ${sizeMB}MB\n`);
  });
  
  console.log('构建工件位置: ' + distDir);

} catch (error) {
  console.error('构建失败:', error.message);
  process.exit(1);
}
})();
