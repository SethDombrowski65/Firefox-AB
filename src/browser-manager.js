import path from 'path';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

export function checkBrowsersInstalled() {
  // 优先使用环境变量，否则从应用根目录查找
  const browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH || 
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'browsers');
  
  let hasChromium = false;
  let hasFirefox = false;
  
  try {
    if (existsSync(browsersDir)) {
      const files = readdirSync(browsersDir);
      hasChromium = files.some(f => f.startsWith('chromium-'));
      hasFirefox = files.some(f => f.startsWith('firefox-'));
    }
  } catch (error) {
    console.error('检查浏览器目录失败:', error.message);
  }
  
  console.log('Browser check - Chromium:', hasChromium, 'Firefox:', hasFirefox, 'Dir:', browsersDir);
  return { hasChromium, hasFirefox, browsersDir };
}
