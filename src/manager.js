import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { generateFingerprint } from './fingerprint.js';
import * as db from './database.js';

const PROFILES_DIR = path.join(os.homedir(), '.browser-manager', 'profiles');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('配置目录:', PROFILES_DIR);

export async function createProfile(name, options = {}) {
  if (!name || name.trim() === '') {
    throw new Error('配置名称不能为空');
  }

  const {
    browserType = 'chromium',
    enableFingerprint = true,
    group = '',
    notes = '',
    starred = false,
    proxy = null,
    startUrl = '',
    customArgs = ''
  } = options;

  if (!['chromium', 'firefox'].includes(browserType)) {
    throw new Error(`不支持的浏览器类型: ${browserType}。支持: chromium, firefox`);
  }

  const profilePath = path.join(PROFILES_DIR, name);
  
  try {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await fs.mkdir(profilePath, { recursive: false });
    
    const fingerprint = enableFingerprint ? generateFingerprint() : null;
    
    const profileData = {
      name,
      browserType,
      enableFingerprint,
      groupId: group,
      notes,
      starred,
      proxyServer: proxy?.server,
      proxyUsername: proxy?.username,
      proxyPassword: proxy?.password,
      startUrl,
      customArgs,
      fingerprint: fingerprint ? JSON.stringify(fingerprint) : null,
      createdAt: new Date().toISOString()
    };
    
    await db.createProfile(profileData);
    
    const metaData = {
      browserType,
      enableFingerprint,
      fingerprint,
      proxy: proxy ? { server: proxy.server, username: proxy.username, password: proxy.password } : null,
      startUrl,
      customArgs
    };
    await fs.writeFile(path.join(profilePath, 'meta.json'), JSON.stringify(metaData, null, 2));
    
    console.log(`✓ 配置 "${name}" 创建成功`);
    return profilePath;
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`配置 "${name}" 已存在`);
    }
    console.error(`创建配置失败:`, error.message);
    throw error;
  }
}

export async function listProfiles() {
  try {
    const profiles = await db.listProfiles();
    
    const profilesWithPath = profiles.map(profile => ({
      ...profile,
      path: path.join(PROFILES_DIR, profile.name)
    }));
    
    console.log(`✓ 已加载 ${profilesWithPath.length} 个配置`);
    return profilesWithPath;
  } catch (error) {
    console.error('加载配置失败:', error.message);
    throw error;
  }
}

export async function removeProfile(name) {
  if (!name || name.trim() === '') {
    throw new Error('配置名称不能为空');
  }

  const profilePath = path.join(PROFILES_DIR, name);
  
  try {
    await db.deleteProfile(name);
    await fs.rm(profilePath, { recursive: true, force: true });
    console.log(`✓ 配置 "${name}" 删除成功`);
  } catch (error) {
    console.error(`删除配置失败:`, error.message);
    throw new Error(`删除配置 "${name}" 失败: ${error.message}`);
  }
}

export function getProfilePath(name) {
  return path.join(PROFILES_DIR, name);
}

export async function updateProfile(name, updates) {
  if (!name || name.trim() === '') {
    throw new Error('配置名称不能为空');
  }
  
  try {
    await db.updateProfile(name, updates);
    
    const profile = await db.getProfile(name);
    const profilePath = path.join(PROFILES_DIR, name);
    const metaData = {
      browserType: profile.browserType,
      enableFingerprint: profile.enableFingerprint,
      fingerprint: profile.fingerprint,
      proxy: profile.proxy,
      startUrl: profile.startUrl,
      customArgs: profile.customArgs
    };
    await fs.writeFile(path.join(profilePath, 'meta.json'), JSON.stringify(metaData, null, 2));
    
    console.log(`✓ 配置 "${name}" 更新成功`);
    return profile;
  } catch (error) {
    console.error(`更新配置失败:`, error.message);
    throw new Error(`更新配置 "${name}" 失败: ${error.message}`);
  }
}

export async function renameProfile(oldName, newName) {
  if (!oldName || oldName.trim() === '') {
    throw new Error('原配置名称不能为空');
  }
  if (!newName || newName.trim() === '') {
    throw new Error('新配置名称不能为空');
  }

  const oldPath = path.join(PROFILES_DIR, oldName);
  const newPath = path.join(PROFILES_DIR, newName);
  
  try {
    await db.renameProfile(oldName, newName);
    await fs.rename(oldPath, newPath);
    console.log(`✓ 配置 "${oldName}" 重命名为 "${newName}" 成功`);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`配置 "${newName}" 已存在`);
    }
    console.error(`重命名配置失败:`, error.message);
    throw new Error(`重命名配置失败: ${error.message}`);
  }
}

export async function updateProfileUsage(name) {
  try {
    await db.updateProfileUsage(name);
  } catch (error) {
    console.error(`更新配置使用统计失败:`, error.message);
  }
}

export async function regenerateFingerprint(name) {
  try {
    const fingerprint = generateFingerprint();
    await db.updateProfile(name, { fingerprint });
    
    const profile = await db.getProfile(name);
    const profilePath = path.join(PROFILES_DIR, name);
    const metaData = {
      browserType: profile.browserType,
      enableFingerprint: profile.enableFingerprint,
      fingerprint: profile.fingerprint,
      proxy: profile.proxy,
      startUrl: profile.startUrl,
      customArgs: profile.customArgs
    };
    await fs.writeFile(path.join(profilePath, 'meta.json'), JSON.stringify(metaData, null, 2));
    
    console.log(`✓ 配置 "${name}" 指纹重新生成成功`);
    return fingerprint;
  } catch (error) {
    console.error(`重新生成指纹失败:`, error.message);
    throw new Error(`重新生成指纹失败: ${error.message}`);
  }
}

export async function createGroup(name, color = 'blue') {
  if (!name || name.trim() === '') {
    throw new Error('分组名称不能为空');
  }

  try {
    const group = await db.createGroup({
      name,
      color,
      createdAt: new Date().toISOString()
    });
    
    console.log(`✓ 分组 "${name}" 创建成功`);
    return group;
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      throw new Error(`分组 "${name}" 已存在`);
    }
    throw error;
  }
}

export async function listGroups() {
  try {
    return await db.listGroups();
  } catch (error) {
    console.error('加载分组失败:', error.message);
    throw error;
  }
}

export async function updateGroup(id, updates) {
  try {
    await db.updateGroup(id, updates);
    console.log(`✓ 分组更新成功`);
    const groups = await db.listGroups();
    return groups.find(g => g.id === id);
  } catch (error) {
    console.error('更新分组失败:', error.message);
    throw error;
  }
}

export async function deleteGroup(id) {
  try {
    await db.deleteGroup(id);
    console.log(`✓ 分组删除成功`);
  } catch (error) {
    console.error('删除分组失败:', error.message);
    throw error;
  }
}

export async function exportProfile(name) {
  try {
    return await db.getProfile(name);
  } catch (error) {
    console.error(`导出配置失败:`, error.message);
    throw new Error(`导出配置失败: ${error.message}`);
  }
}

export async function importProfile(name, config) {
  const profilePath = path.join(PROFILES_DIR, name);
  
  try {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    await fs.mkdir(profilePath, { recursive: false });
    
    const profileData = {
      name,
      browserType: config.browserType,
      enableFingerprint: config.enableFingerprint,
      groupId: config.group,
      notes: config.notes,
      starred: config.starred,
      proxyServer: config.proxy?.server,
      proxyUsername: config.proxy?.username,
      proxyPassword: config.proxy?.password,
      startUrl: config.startUrl,
      customArgs: config.customArgs,
      fingerprint: config.fingerprint ? JSON.stringify(config.fingerprint) : null,
      createdAt: new Date().toISOString()
    };
    
    await db.createProfile(profileData);
    
    const metaData = {
      browserType: config.browserType,
      enableFingerprint: config.enableFingerprint,
      fingerprint: config.fingerprint,
      proxy: config.proxy || null,
      startUrl: config.startUrl,
      customArgs: config.customArgs
    };
    await fs.writeFile(path.join(profilePath, 'meta.json'), JSON.stringify(metaData, null, 2));
    
    console.log(`✓ 配置 "${name}" 导入成功`);
    return profilePath;
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`配置 "${name}" 已存在`);
    }
    console.error(`导入配置失败:`, error.message);
    throw error;
  }
}

export async function batchDeleteProfiles(names) {
  const results = await db.batchDeleteProfiles(names);
  
  for (const result of results) {
    if (result.success) {
      const profilePath = path.join(PROFILES_DIR, result.name);
      try {
        await fs.rm(profilePath, { recursive: true, force: true });
      } catch (error) {
        console.error(`删除配置目录失败 ${result.name}:`, error.message);
      }
    }
  }
  
  return results;
}
