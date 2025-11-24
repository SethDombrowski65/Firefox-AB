#!/usr/bin/env node

import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import {
  createProfile,
  listProfiles,
  removeProfile,
  updateProfile,
  renameProfile,
  regenerateFingerprint,
  createGroup,
  listGroups,
  updateGroup,
  deleteGroup,
  exportProfile,
  importProfile,
  batchDeleteProfiles
} from './manager.js';
import { launchBrowser, closeBrowser } from './launcher.js';
import { readFileSync, writeFileSync } from 'fs';

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const possibleBrowsersPaths = [
    path.join(__dirname, '..', 'browsers'),
    path.join(process.cwd(), 'browsers')
  ];
  
  for (const candidatePath of possibleBrowsersPaths) {
    if (existsSync(candidatePath)) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = candidatePath;
      break;
    }
  }
}

let runningBrowsers = new Map();

const colors = {
  primary: chalk.cyan,
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  dim: chalk.dim
};

function printHeader(text) {
  console.clear();
  console.log(colors.primary('╔════════════════════════════════════════╗'));
  console.log(colors.primary('║') + chalk.bold.cyan('  浏览器配置管理器 v1.0.0  ') + colors.primary('║'));
  console.log(colors.primary('╚════════════════════════════════════════╝'));
  if (text) console.log(colors.info(`\n${text}\n`));
}

function showSuccess(message) {
  console.log(colors.success(`✓ ${message}`));
}

function showError(message) {
  console.log(colors.error(`✗ ${message}`));
}

function showInfo(message) {
  console.log(colors.info(`ℹ ${message}`));
}

async function cleanupClosedBrowsers() {
  const toRemove = [];
  for (const [name, context] of runningBrowsers) {
    try {
      if (context.pages && await context.pages().then(pages => pages.length === 0).catch(() => false)) {
        toRemove.push(name);
      }
    } catch (error) {
      toRemove.push(name);
    }
  }
  toRemove.forEach(name => runningBrowsers.delete(name));
}

function formatProfileRow(profile, groups) {
  const groupName = profile.group ? groups.find(g => g.id === profile.group)?.name || '-' : '-';
  const running = runningBrowsers.has(profile.name) ? '[●]' : '   ';
  const starred = profile.starred ? ' ★' : '  ';
  const proxy = profile.proxy ? ' ✓' : '  ';
  const fingerprint = profile.enableFingerprint !== false ? ' ✓' : '  ';
  
  return [
    running + ' ' + profile.name,
    profile.browserType === 'firefox' ? 'Firefox' : 'Chromium',
    groupName,
    starred,
    proxy,
    fingerprint,
    profile.useCount || 0
  ];
}

async function showMainMenu() {
  await cleanupClosedBrowsers();
  printHeader();
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作',
      choices: [
        { name: '[1] 查看所有配置', value: 'list' },
        { name: '[2] 创建新配置', value: 'create' },
        { name: '[3] 打开配置', value: 'open' },
        { name: '[4] 编辑配置', value: 'edit' },
        { name: '[5] 重命名配置', value: 'rename' },
        { name: '[6] 删除配置', value: 'delete' },
        { name: '[7] 星标管理', value: 'star' },
        { name: '[8] 重新生成指纹', value: 'fingerprint' },
        { name: '[9] 分组管理', value: 'group' },
        { name: '[10] 导出配置', value: 'export' },
        { name: '[11] 导入配置', value: 'import' },
        { name: '[12] 批量删除', value: 'batchDelete' },
        { name: '[13] 关闭浏览器', value: 'closeBrowser' },
        { name: '[14] 退出', value: 'exit' }
      ],
      pageSize: 14
    }
  ]);

  switch(action) {
    case 'list': await listProfilesMenu(); break;
    case 'create': await createProfileMenu(); break;
    case 'open': await openProfileMenu(); break;
    case 'edit': await editProfileMenu(); break;
    case 'rename': await renameProfileMenu(); break;
    case 'delete': await deleteProfileMenu(); break;
    case 'star': await starManagementMenu(); break;
    case 'fingerprint': await fingerprintMenu(); break;
    case 'group': await groupManagementMenu(); break;
    case 'export': await exportProfileMenu(); break;
    case 'import': await importProfileMenu(); break;
    case 'batchDelete': await batchDeleteMenu(); break;
    case 'closeBrowser': await closeBrowserMenu(); break;
    case 'exit': process.exit(0);
  }
}

async function listProfilesMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showInfo('创建一个新配置来开始');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 继续...' }]);
      return showMainMenu();
    }

    printHeader(`配置列表 (共 ${profiles.length} 个)`);

    const table = new Table({
      head: ['', '名称', '浏览器', '分组', '★', 'Proxy', '指纹', '使用次数'],
      style: { head: [], border: ['cyan'] },
      wordWrap: true,
      colWidths: [5, 20, 12, 12, 3, 6, 6, 8]
    });

    profiles.forEach(p => {
      table.push(formatProfileRow(p, groups));
    });

    console.log(table.toString());
    console.log(colors.dim('[●] = 运行中\n'));
    await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
    return showMainMenu();
  } catch (error) {
    showError(error.message);
    await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
    return showMainMenu();
  }
}

async function createProfileMenu() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '配置名称',
        validate: (input) => input.trim() ? true : '名称不能为空'
      },
      {
        type: 'list',
        name: 'browserType',
        message: '浏览器类型',
        choices: [
          { name: '[1] Chromium', value: 'chromium' },
          { name: '[2] Firefox', value: 'firefox' }
        ]
      },
      {
        type: 'confirm',
        name: 'enableFingerprint',
        message: '启用指纹保护',
        default: true
      },
      {
        type: 'input',
        name: 'proxy',
        message: '代理地址 (可选，如 http://proxy.com:8080)',
        default: ''
      },
      {
        type: 'input',
        name: 'startUrl',
        message: '启动 URL (可选)',
        default: ''
      }
    ]);

    const spinner = ora('正在创建配置...').start();
    
    await createProfile(answers.name, {
      browserType: answers.browserType,
      enableFingerprint: answers.enableFingerprint,
      proxy: answers.proxy ? { server: answers.proxy } : null,
      startUrl: answers.startUrl
    });

    spinner.succeed('配置创建成功');
    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function openProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showError('没有可打开的配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const choices = profiles.map(p => ({
      name: `${runningBrowsers.has(p.name) ? '[●]' : '   '} ${p.name} (${p.browserType})`,
      value: p.name,
      disabled: runningBrowsers.has(p.name) ? '已运行' : false
    }));

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要打开的配置',
        choices
      }
    ]);

    const profile = profiles.find(p => p.name === profileName);
    const spinner = ora(`正在启动 ${profileName}...`).start();

    const { context } = await launchBrowser(profile.path, profile.name);
    runningBrowsers.set(profile.name, context);

    spinner.succeed('浏览器已启动，返回主菜单...');
    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function editProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要编辑的配置',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    const profile = profiles.find(p => p.name === profileName);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'proxy',
        message: '代理地址 (可选)',
        default: profile.proxy?.server || ''
      },
      {
        type: 'input',
        name: 'startUrl',
        message: '启动 URL (可选)',
        default: profile.startUrl || ''
      },
      {
        type: 'input',
        name: 'notes',
        message: '备注 (可选)',
        default: profile.notes || ''
      }
    ]);

    const spinner = ora('正在保存配置...').start();

    await updateProfile(profileName, {
      proxy: answers.proxy ? { server: answers.proxy } : null,
      startUrl: answers.startUrl,
      notes: answers.notes
    });

    spinner.succeed('配置已更新');
    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function renameProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { oldName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'oldName',
        message: '选择要重命名的配置',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: '新名称',
        validate: (input) => input.trim() ? true : '名称不能为空'
      }
    ]);

    const spinner = ora('正在重命名...').start();
    await renameProfile(oldName, newName);
    spinner.succeed('配置已重命名');

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function deleteProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要删除的配置',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除配置 "${profileName}"?`,
        default: false
      }
    ]);

    if (!confirm) {
      showInfo('已取消');
      return showMainMenu();
    }

    const spinner = ora('正在删除...').start();
    await removeProfile(profileName);
    spinner.succeed('配置已删除');

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function starManagementMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择配置',
        choices: profiles.map(p => ({
          name: `${p.starred ? ' ★' : '  '} ${p.name}`,
          value: p.name
        }))
      }
    ]);

    const profile = profiles.find(p => p.name === profileName);
    const spinner = ora('正在更新...').start();

    await updateProfile(profileName, { starred: !profile.starred });
    spinner.succeed(`已${profile.starred ? '取消' : ''}星标`);

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function fingerprintMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择配置',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    const spinner = ora('正在重新生成指纹...').start();
    await regenerateFingerprint(profileName);
    spinner.succeed('指纹已重新生成');

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function groupManagementMenu() {
  printHeader('分组管理');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择操作',
      choices: [
        { name: '[1] 查看所有分组', value: 'list' },
        { name: '[2] 创建分组', value: 'create' },
        { name: '[3] 编辑分组', value: 'edit' },
        { name: '[4] 删除分组', value: 'delete' },
        { name: '[0] 返回主菜单', value: 'back' }
      ]
    }
  ]);

  switch(action) {
    case 'list': await listGroupsMenu(); break;
    case 'create': await createGroupMenu(); break;
    case 'edit': await editGroupMenu(); break;
    case 'delete': await deleteGroupMenu(); break;
    case 'back': return showMainMenu();
  }
}

async function listGroupsMenu() {
  try {
    const groups = await listGroups();
    const profiles = await listProfiles();

    if (groups.length === 0) {
      printHeader('暂无分组');
      showInfo('创建一个新分组');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return groupManagementMenu();
    }

    printHeader(`分组列表 (共 ${groups.length} 个)`);

    const table = new Table({
      head: ['分组名称', '颜色', '配置数量'],
      style: { head: [], border: ['cyan'] },
      colWidths: [25, 12, 10]
    });

    groups.forEach(g => {
      const count = profiles.filter(p => p.group === g.id).length;
      table.push([g.name, g.color, count]);
    });

    console.log(table.toString());
    await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
    return groupManagementMenu();
  } catch (error) {
    showError(error.message);
    await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
    return groupManagementMenu();
  }
}

async function createGroupMenu() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '分组名称',
        validate: (input) => input.trim() ? true : '名称不能为空'
      },
      {
        type: 'list',
        name: 'color',
        message: '颜色',
        choices: [
          { name: '[1] blue', value: 'blue' },
          { name: '[2] green', value: 'green' },
          { name: '[3] red', value: 'red' },
          { name: '[4] purple', value: 'purple' },
          { name: '[5] yellow', value: 'yellow' },
          { name: '[6] cyan', value: 'cyan' }
        ],
        default: 'blue'
      }
    ]);

    const spinner = ora('正在创建分组...').start();
    await createGroup(answers.name, answers.color);
    spinner.succeed('分组创建成功');

    return groupManagementMenu();
  } catch (error) {
    showError(error.message);
    return groupManagementMenu();
  }
}

async function editGroupMenu() {
  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      printHeader('暂无分组');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return groupManagementMenu();
    }

    const { groupId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'groupId',
        message: '选择要编辑的分组',
        choices: groups.map(g => ({ name: g.name, value: g.id }))
      }
    ]);

    const group = groups.find(g => g.id === groupId);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '分组名称',
        default: group.name
      },
      {
        type: 'list',
        name: 'color',
        message: '颜色',
        choices: [
          { name: '[1] blue', value: 'blue' },
          { name: '[2] green', value: 'green' },
          { name: '[3] red', value: 'red' },
          { name: '[4] purple', value: 'purple' },
          { name: '[5] yellow', value: 'yellow' },
          { name: '[6] cyan', value: 'cyan' }
        ],
        default: group.color
      }
    ]);

    const spinner = ora('正在保存...').start();
    await updateGroup(groupId, answers);
    spinner.succeed('分组已更新');

    return groupManagementMenu();
  } catch (error) {
    showError(error.message);
    return groupManagementMenu();
  }
}

async function deleteGroupMenu() {
  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      printHeader('暂无分组');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return groupManagementMenu();
    }

    const { groupId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'groupId',
        message: '选择要删除的分组',
        choices: groups.map(g => ({ name: g.name, value: g.id }))
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认删除该分组?',
        default: false
      }
    ]);

    if (!confirm) {
      showInfo('已取消');
      return groupManagementMenu();
    }

    const spinner = ora('正在删除...').start();
    await deleteGroup(groupId);
    spinner.succeed('分组已删除');

    return groupManagementMenu();
  } catch (error) {
    showError(error.message);
    return groupManagementMenu();
  }
}

async function exportProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要导出的配置',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    const spinner = ora('正在导出...').start();
    const config = await exportProfile(profileName);
    const filename = `${profileName}.json`;
    writeFileSync(filename, JSON.stringify(config, null, 2));
    spinner.succeed(`配置已导出到: ${filename}`);

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function importProfileMenu() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: '配置文件路径',
        validate: (input) => input.trim() ? true : '路径不能为空'
      },
      {
        type: 'input',
        name: 'name',
        message: '新配置名称',
        validate: (input) => input.trim() ? true : '名称不能为空'
      }
    ]);

    const spinner = ora('正在导入...').start();
    const content = readFileSync(answers.filename, 'utf-8');
    const config = JSON.parse(content);
    await importProfile(answers.name, config);
    spinner.succeed('配置导入成功');

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function batchDeleteMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const { selectedProfiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProfiles',
        message: '选择要删除的配置 (Space 选择，Enter 确认)',
        choices: profiles.map(p => ({ name: p.name, value: p.name })),
        validate: (input) => input.length > 0 ? true : '至少选择一个配置'
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除 ${selectedProfiles.length} 个配置?`,
        default: false
      }
    ]);

    if (!confirm) {
      showInfo('已取消');
      return showMainMenu();
    }

    const spinner = ora('正在删除...').start();
    await batchDeleteProfiles(selectedProfiles);
    spinner.succeed(`成功删除 ${selectedProfiles.length} 个配置`);

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function closeBrowserMenu() {
  try {
    await cleanupClosedBrowsers();

    if (runningBrowsers.size === 0) {
      printHeader('关闭浏览器');
      showInfo('没有运行中的浏览器');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return showMainMenu();
    }

    const browserList = Array.from(runningBrowsers.keys());
    const { browserName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'browserName',
        message: '选择要关闭的浏览器',
        choices: [
          ...browserList.map((name, i) => ({ name: `[${i+1}] ${name}`, value: name })),
          { name: '[A] 关闭全部', value: 'all' },
          { name: '[0] 取消', value: 'cancel' }
        ]
      }
    ]);

    if (browserName === 'cancel') {
      return showMainMenu();
    }

    const spinner = ora('正在关闭...').start();

    if (browserName === 'all') {
      for (const [name, context] of runningBrowsers) {
        try {
          await closeBrowser(context);
        } catch (error) {
          console.error(`关闭 ${name} 失败:`, error.message);
        }
      }
      runningBrowsers.clear();
      spinner.succeed('所有浏览器已关闭');
    } else {
      const context = runningBrowsers.get(browserName);
      await closeBrowser(context);
      runningBrowsers.delete(browserName);
      spinner.succeed('浏览器已关闭');
    }

    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

process.on('SIGINT', async () => {
  console.log('\n');
  const spinner = ora('正在关闭所有浏览器...').start();
  for (const [name, context] of runningBrowsers) {
    try {
      await closeBrowser(context);
    } catch (error) {
      console.error(`关闭 ${name} 失败:`, error.message);
    }
  }
  spinner.succeed('已退出');
  process.exit(0);
});

showMainMenu();
