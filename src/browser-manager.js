import path from 'path';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

export function checkBrowsersInstalled() {
  let browsersDir = process.env.PLAYWRIGHT_BROWSERS_PATH;
  
  if (!browsersDir) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const possiblePaths = [
      path.join(__dirname, '..', 'browsers'),
      path.join(path.dirname(__dirname), 'browsers'),
      path.join(process.cwd(), 'browsers')
    ];
    
    for (const candidatePath of possiblePaths) {
      if (existsSync(candidatePath)) {
        browsersDir = candidatePath;
        break;
      }
    }
  }
  
  if (!browsersDir) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    browsersDir = path.join(__dirname, '..', 'browsers');
  }
  
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
