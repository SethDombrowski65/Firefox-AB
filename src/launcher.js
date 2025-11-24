import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { getFingerPrintScript } from './fingerprint.js';
import { updateProfileUsage } from './manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH;

if (!browsersPath) {
  const possiblePaths = [
    path.join(__dirname, '..', 'browsers'),
    path.join(path.dirname(__dirname), 'browsers'),
    path.join(process.cwd(), 'browsers')
  ];
  
  for (const candidatePath of possiblePaths) {
    if (existsSync(candidatePath)) {
      browsersPath = candidatePath;
      break;
    }
  }
}

if (!browsersPath) {
  browsersPath = path.join(__dirname, '..', 'browsers');
}

const appRoot = path.dirname(browsersPath);
const PLUGINS_DIR = path.join(appRoot, 'plugins');

console.log('\n========== Launcher Module ==========');
console.log('App Root:', appRoot);
console.log('Browsers Path:', browsersPath);
console.log('Plugins Dir:', PLUGINS_DIR);
console.log('Browsers Exist:', existsSync(browsersPath));
console.log('Plugins Exist:', existsSync(PLUGINS_DIR));
console.log('=====================================\n');

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function getPlaywright() {
  const { chromium, firefox } = await import('playwright');
  return { chromium, firefox };
}

async function getExtensionPaths() {
  const extensions = [];
  const chromeDir = path.join(PLUGINS_DIR, 'chrome');
  
  try {
    const entries = await fs.readdir(chromeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const manifestPath = path.join(chromeDir, entry.name, 'manifest.json');
      if (await pathExists(manifestPath)) {
        const extensionPath = path.join(chromeDir, entry.name);
        extensions.push(extensionPath);
        console.log(`✓ 已加载 Chrome 扩展: ${entry.name}`);
      }
    }
    return extensions;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠ Chrome 插件目录不存在');
      return [];
    }
    console.error('获取 Chrome 扩展失败:', error.message);
    return [];
  }
}

async function getFirefoxExtensions() {
  const extensions = [];
  const firefoxDir = path.join(PLUGINS_DIR, 'firefox');
  
  try {
    const entries = await fs.readdir(firefoxDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const manifestPath = path.join(firefoxDir, entry.name, 'manifest.json');
        if (await pathExists(manifestPath)) {
          extensions.push(entry.name);
          console.log(`✓ 已找到 Firefox 扩展: ${entry.name}`);
        }
      }
    }
    return extensions;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('⚠ Firefox 插件目录不存在');
      return [];
    }
    console.error('获取 Firefox 扩展失败:', error.message);
    return [];
  }
}

export async function launchBrowser(profilePath, profileName) {
  if (!profilePath) {
    throw new Error('配置路径是必需的');
  }

  const metaPath = path.join(profilePath, 'meta.json');
  let metaData = {
    browserType: 'chromium',
    enableFingerprint: true,
    fingerprint: null,
    proxy: null,
    startUrl: '',
    customArgs: ''
  };

  try {
    const meta = await fs.readFile(metaPath, 'utf-8');
    metaData = { ...metaData, ...JSON.parse(meta) };
  } catch (error) {
    console.log('⚠ 无法读取配置文件，使用默认设置');
  }

  const { browserType, enableFingerprint, fingerprint, proxy, startUrl, customArgs } = metaData;

  if (!['chromium', 'firefox'].includes(browserType)) {
    throw new Error(`不支持的浏览器类型: ${browserType}。支持: chromium, firefox`);
  }

  console.log(`启动浏览器: ${browserType}, 配置路径: ${profilePath}`);
  
  if (enableFingerprint && fingerprint) {
    console.log(`✓ 使用保存的指纹配置`);
  }

  try {
    await fs.mkdir(profilePath, { recursive: true });
    console.log(`✓ 配置目录已就绪: ${profilePath}`);
  } catch (error) {
    console.error(`配置目录处理失败:`, error.message);
    throw new Error(`配置目录处理失败: ${error.message}`);
  }

  const extensions = await getExtensionPaths();

  const launchArgs = ['--disable-blink-features=AutomationControlled'];
  if (extensions.length) {
    const joinedExtensions = extensions.join(',');
    launchArgs.push(`--disable-extensions-except=${joinedExtensions}`);
    launchArgs.push(`--load-extension=${joinedExtensions}`);
  }

  if (customArgs) {
    const customArgsArray = customArgs.split(' ').filter(arg => arg.trim());
    launchArgs.push(...customArgsArray);
  }

  if (browserType === 'firefox') {
    const firefoxExtDir = path.join(profilePath, 'extensions');
    try {
      await fs.mkdir(firefoxExtDir, { recursive: true });
      const firefoxPluginDir = path.join(PLUGINS_DIR, 'firefox');
      const extensions = await getFirefoxExtensions();
      if (extensions.length > 0) {
        for (const extName of extensions) {
          const extSourcePath = path.join(firefoxPluginDir, extName);
          const extTargetPath = path.join(firefoxExtDir, extName);
          try {
            await fs.cp(extSourcePath, extTargetPath, { recursive: true, force: true });
            console.log(`✓ Firefox 扩展已安装: ${extName}`);
          } catch (error) {
            console.error(`复制 Firefox 扩展失败: ${extName}`, error.message);
          }
        }
      } else {
        console.log('⚠ 未找到 Firefox 扩展');
      }
    } catch (error) {
      console.error('处理 Firefox 扩展失败:', error.message);
    }
  }

  let context;
  try {
    const { chromium, firefox } = await getPlaywright();
    
    const launchOptions = {
      headless: false,
      locale: 'zh-CN'
    };

    if (proxy && proxy.server) {
      launchOptions.proxy = {
        server: proxy.server
      };
      if (proxy.username) {
        launchOptions.proxy.username = proxy.username;
      }
      if (proxy.password) {
        launchOptions.proxy.password = proxy.password;
      }
      if (proxy.bypass) {
        launchOptions.proxy.bypass = proxy.bypass;
      }
      console.log(`✓ 使用代理: ${proxy.server}`);
    }
    
    if (browserType === 'chromium') {
      context = await chromium.launchPersistentContext(profilePath, {
        ...launchOptions,
        args: launchArgs,
        userAgent: fingerprint?.userAgent
      });
    } else if (browserType === 'firefox') {
      context = await firefox.launchPersistentContext(profilePath, {
        ...launchOptions,
        firefoxUserPrefs: {
          'extensions.autoDisableScopes': 0,
          'extensions.enabledScopes': 15,
          'xpinstall.signatures.required': false,
          'extensions.installDistroAddons': true
        }
      });
    }
    
    if (fingerprint) {
      const script = getFingerPrintScript(fingerprint);
      await context.addInitScript(script);
    }

    let [page] = context.pages();
    if (!page) {
      page = await context.newPage();
    }
    
    if (startUrl) {
      try {
        await page.goto(startUrl);
        console.log(`✓ 已导航到启动页面: ${startUrl}`);
      } catch (error) {
        console.log(`⚠ 无法打开启动页面: ${error.message}`);
      }
    }

    await page.bringToFront();

    if (profileName) {
      await updateProfileUsage(profileName);
    }

    console.log(`✓ 浏览器启动成功: ${browserType}`);
    return { context, page, browserType, fingerprint };
  } catch (error) {
    console.error(`启动浏览器失败:`, error.message);
    throw new Error(`启动浏览器失败: ${error.message}`);
  }
}

export async function closeBrowser(context) {
  try {
    if (context) {
      await context.close();
      console.log('✓ 浏览器已关闭');
    }
  } catch (error) {
    console.error(`关闭浏览器失败:`, error.message);
    throw new Error(`关闭浏览器失败: ${error.message}`);
  }
}
