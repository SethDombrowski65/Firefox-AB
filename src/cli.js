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
  listGroups,
  createGroup,
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
    let isClosed = false;
    
    try {
      if (!context) {
        isClosed = true;
      } else {
        const pages = await context.pages().catch(() => null);
        if (pages === null) {
          isClosed = true;
        } else if (pages.length === 0) {
          isClosed = true;
        }
      }
    } catch (error) {
      isClosed = true;
    }
    
    if (isClosed) {
      toRemove.push(name);
    }
  }
  
  toRemove.forEach(name => {
    runningBrowsers.delete(name);
  });
  
  return toRemove;
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
        { name: '[1] 管理配置', value: 'configMgmt' },
        { name: '[2] 管理分组', value: 'groupMgmt' },
        { name: '[3] 备份管理', value: 'backupMgmt' },
        { name: '[4] 退出', value: 'exit' }
      ],
      pageSize: 4
    }
  ]);

  switch(action) {
    case 'configMgmt': await configManagementMenu(); break;
    case 'groupMgmt': await groupManagementMenu(); break;
    case 'backupMgmt': await backupManagementMenu(); break;
    case 'exit': await exitApp(); break;
  }
}

async function configManagementMenu() {
  await cleanupClosedBrowsers();
  printHeader('管理配置');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择操作',
      choices: [
        { name: '[1] 打开配置', value: 'open' },
        { name: '[2] 创建配置', value: 'create' },
        { name: '[3] 删除配置', value: 'delete' },
        { name: '[4] 批量删除配置', value: 'batchDelete' },
        { name: '[5] 批量导出配置', value: 'batchExport' },
        { name: '[0] 返回主菜单', value: 'back' }
      ]
    }
  ]);

  switch(action) {
    case 'open': await openProfileMenu(); break;
    case 'create': await createProfileMenu(); break;
    case 'delete': await deleteProfileMenu(); break;
    case 'batchDelete': await batchDeleteProfilesMenu(); break;
    case 'batchExport': await batchExportProfilesMenu(); break;
    case 'back': return showMainMenu();
  }
}

async function openProfileMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showError('没有可打开的配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return configManagementMenu();
    }

    const choices = profiles.map(p => {
      const groupName = p.group ? groups.find(g => g.id === p.group)?.name : '-';
      const running = runningBrowsers.has(p.name) ? '[●]' : '   ';
      return {
        name: `${running} ${p.name} (${p.browserType}) [${groupName}]`,
        value: p.name,
        disabled: runningBrowsers.has(p.name) ? '已运行' : false
      };
    });

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

    spinner.succeed('浏览器已启动，返回菜单...');
    return configManagementMenu();
  } catch (error) {
    showError(error.message);
    return configManagementMenu();
  }
}

async function createProfileMenu() {
  try {
    const groups = await listGroups();
    
    const groupChoices = groups.length > 0 
      ? groups.map((g, i) => ({ name: `[${i+1}] ${g.name}`, value: g.id }))
      : [];
    groupChoices.push({ name: '[0] 无分组', value: '' });

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
        type: 'list',
        name: 'group',
        message: '选择分组',
        choices: groupChoices
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
      enableFingerprint: true,
      group: answers.group,
      proxy: answers.proxy ? { server: answers.proxy } : null,
      startUrl: answers.startUrl
    });

    spinner.succeed('配置创建成功');
    return configManagementMenu();
  } catch (error) {
    showError(error.message);
    return configManagementMenu();
  }
}

async function deleteProfileMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showInfo('没有可删除的配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return configManagementMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要删除的配置',
        choices: profiles.map((p, i) => {
          const groupName = p.group ? groups.find(g => g.id === p.group)?.name : '-';
          return {
            name: `[${i+1}] ${p.name} [${groupName}]`,
            value: p.name
          };
        })
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
      return configManagementMenu();
    }

    const spinner = ora('正在删除...').start();
    await removeProfile(profileName);
    spinner.succeed('配置已删除');

    return configManagementMenu();
  } catch (error) {
    showError(error.message);
    return configManagementMenu();
  }
}

async function batchDeleteProfilesMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showInfo('没有可删除的配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return configManagementMenu();
    }

    const { selectedProfiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProfiles',
        message: '选择要删除的配置 (Space 选择，Enter 确认)',
        choices: profiles.map((p, i) => {
          const groupName = p.group ? groups.find(g => g.id === p.group)?.name : '-';
          return {
            name: `[${i+1}] ${p.name} [${groupName}]`,
            value: p.name
          };
        }),
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
      return configManagementMenu();
    }

    const spinner = ora('正在删除...').start();
    await batchDeleteProfiles(selectedProfiles);
    spinner.succeed(`成功删除 ${selectedProfiles.length} 个配置`);

    return configManagementMenu();
  } catch (error) {
    showError(error.message);
    return configManagementMenu();
  }
}

async function batchExportProfilesMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showError('没有可导出的配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return configManagementMenu();
    }

    const { selectedProfiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProfiles',
        message: '选择要导出的配置 (Space 选择，Enter 确认)',
        choices: profiles.map((p, i) => {
          const groupName = p.group ? groups.find(g => g.id === p.group)?.name : '-';
          return {
            name: `[${i+1}] ${p.name} [${groupName}]`,
            value: p.name
          };
        }),
        validate: (input) => input.length > 0 ? true : '至少选择一个配置'
      }
    ]);

    const spinner = ora('正在导出...').start();
    for (const profileName of selectedProfiles) {
      const config = await exportProfile(profileName);
      const filename = `${profileName}.json`;
      writeFileSync(filename, JSON.stringify(config, null, 2));
    }
    spinner.succeed(`成功导出 ${selectedProfiles.length} 个配置`);

    return configManagementMenu();
  } catch (error) {
    showError(error.message);
    return configManagementMenu();
  }
}

async function groupManagementMenu() {
  await cleanupClosedBrowsers();
  printHeader('管理分组');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择操作',
      choices: [
        { name: '[1] 查看分组', value: 'list' },
        { name: '[2] 创建分组', value: 'create' },
        { name: '[3] 删除分组', value: 'delete' },
        { name: '[4] 批量删除分组', value: 'batchDelete' },
        { name: '[0] 返回主菜单', value: 'back' }
      ]
    }
  ]);

  switch(action) {
    case 'list': await listGroupsMenu(); break;
    case 'create': await createGroupMenu(); break;
    case 'delete': await deleteGroupMenu(); break;
    case 'batchDelete': await batchDeleteGroupsMenu(); break;
    case 'back': return showMainMenu();
  }
}

async function listGroupsMenu() {
  await cleanupClosedBrowsers();
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
      colWidths: [25, 12, 15]
    });

    groups.forEach(g => {
      const count = profiles.filter(p => p.group === g.id).length;
      table.push([g.name, g.color, count]);
    });

    console.log(table.toString());
    
    const { enterGroup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'enterGroup',
        message: '是否进入某个分组查看和操作配置?',
        default: false
      }
    ]);

    if (!enterGroup) {
      return groupManagementMenu();
    }

    const { groupId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'groupId',
        message: '选择分组',
        choices: groups.map((g, i) => ({
          name: `[${i+1}] ${g.name}`,
          value: g.id
        }))
      }
    ]);

    return groupProfilesMenu(groupId, groups);
  } catch (error) {
    showError(error.message);
    await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
    return groupManagementMenu();
  }
}

async function groupProfilesMenu(groupId, groups) {
  await cleanupClosedBrowsers();
  try {
    const group = groups.find(g => g.id === groupId);
    const profiles = await listProfiles();
    const groupProfiles = profiles.filter(p => p.group === groupId);

    if (groupProfiles.length === 0) {
      printHeader(`分组 "${group.name}" - 暂无配置`);
      showInfo('该分组下没有配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return listGroupsMenu();
    }

    printHeader(`分组 "${group.name}" - ${groupProfiles.length} 个配置`);

    const table = new Table({
      head: ['配置名称', '浏览器', '状态'],
      style: { head: [], border: ['cyan'] },
      colWidths: [30, 15, 10]
    });

    groupProfiles.forEach((p, i) => {
      const running = runningBrowsers.has(p.name) ? '[●]' : '   ';
      table.push([`[${i+1}] ${p.name}`, p.browserType, running]);
    });

    console.log(table.toString());

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '选择操作',
        choices: [
          { name: '[1] 打开配置', value: 'open' },
          { name: '[2] 删除配置', value: 'delete' },
          { name: '[3] 批量删除配置', value: 'batchDelete' },
          { name: '[4] 批量导出配置', value: 'batchExport' },
          { name: '[0] 返回', value: 'back' }
        ]
      }
    ]);

    switch(action) {
      case 'open': return groupOpenProfileMenu(groupProfiles);
      case 'delete': return groupDeleteProfileMenu(groupProfiles);
      case 'batchDelete': return groupBatchDeleteProfilesMenu(groupProfiles);
      case 'batchExport': return groupBatchExportProfilesMenu(groupProfiles);
      case 'back': return listGroupsMenu();
    }
  } catch (error) {
    showError(error.message);
    return listGroupsMenu();
  }
}

async function groupOpenProfileMenu(groupProfiles) {
  try {
    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要打开的配置',
        choices: groupProfiles.map((p, i) => {
          const running = runningBrowsers.has(p.name) ? '[●]' : '   ';
          return {
            name: `${running} [${i+1}] ${p.name}`,
            value: p.name,
            disabled: runningBrowsers.has(p.name) ? '已运行' : false
          };
        })
      }
    ]);

    const profile = groupProfiles.find(p => p.name === profileName);
    const spinner = ora(`正在启动 ${profileName}...`).start();

    const { context } = await launchBrowser(profile.path, profile.name);
    runningBrowsers.set(profile.name, context);

    spinner.succeed('浏览器已启动');
    const { backToGroup } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'backToGroup',
        message: '返回分组菜单?',
        default: true
      }
    ]);

    if (backToGroup) {
      const groups = await listGroups();
      return groupProfilesMenu(profile.group, groups);
    }
    return showMainMenu();
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function groupDeleteProfileMenu(groupProfiles) {
  try {
    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要删除的配置',
        choices: groupProfiles.map((p, i) => ({
          name: `[${i+1}] ${p.name}`,
          value: p.name
        }))
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除 "${profileName}"?`,
        default: false
      }
    ]);

    if (!confirm) {
      showInfo('已取消');
      const groups = await listGroups();
      return groupProfilesMenu(groupProfiles[0].group, groups);
    }

    const spinner = ora('正在删除...').start();
    await removeProfile(profileName);
    spinner.succeed('配置已删除');

    const groups = await listGroups();
    return groupProfilesMenu(groupProfiles[0].group, groups);
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function groupBatchDeleteProfilesMenu(groupProfiles) {
  try {
    const { selectedProfiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProfiles',
        message: '选择要删除的配置',
        choices: groupProfiles.map((p, i) => ({
          name: `[${i+1}] ${p.name}`,
          value: p.name
        })),
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
      const groups = await listGroups();
      return groupProfilesMenu(groupProfiles[0].group, groups);
    }

    const spinner = ora('正在删除...').start();
    await batchDeleteProfiles(selectedProfiles);
    spinner.succeed(`成功删除 ${selectedProfiles.length} 个配置`);

    const groups = await listGroups();
    return groupProfilesMenu(groupProfiles[0].group, groups);
  } catch (error) {
    showError(error.message);
    return showMainMenu();
  }
}

async function groupBatchExportProfilesMenu(groupProfiles) {
  try {
    const { selectedProfiles } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedProfiles',
        message: '选择要导出的配置',
        choices: groupProfiles.map((p, i) => ({
          name: `[${i+1}] ${p.name}`,
          value: p.name
        })),
        validate: (input) => input.length > 0 ? true : '至少选择一个配置'
      }
    ]);

    const spinner = ora('正在导出...').start();
    for (const profileName of selectedProfiles) {
      const config = await exportProfile(profileName);
      const filename = `${profileName}.json`;
      writeFileSync(filename, JSON.stringify(config, null, 2));
    }
    spinner.succeed(`成功导出 ${selectedProfiles.length} 个配置`);

    const groups = await listGroups();
    return groupProfilesMenu(groupProfiles[0].group, groups);
  } catch (error) {
    showError(error.message);
    return showMainMenu();
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
      }
    ]);

    const spinner = ora('正在创建分组...').start();
    await createGroup(answers.name, 'blue');
    spinner.succeed('分组创建成功');

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
        choices: groups.map((g, i) => ({
          name: `[${i+1}] ${g.name}`,
          value: g.id
        }))
      }
    ]);

    const groupName = groups.find(g => g.id === groupId).name;
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除分组 "${groupName}"?`,
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

async function batchDeleteGroupsMenu() {
  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      printHeader('暂无分组');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return groupManagementMenu();
    }

    const { selectedGroups } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedGroups',
        message: '选择要删除的分组',
        choices: groups.map((g, i) => ({
          name: `[${i+1}] ${g.name}`,
          value: g.id
        })),
        validate: (input) => input.length > 0 ? true : '至少选择一个分组'
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除 ${selectedGroups.length} 个分组?`,
        default: false
      }
    ]);

    if (!confirm) {
      showInfo('已取消');
      return groupManagementMenu();
    }

    const spinner = ora('正在删除...').start();
    for (const groupId of selectedGroups) {
      await deleteGroup(groupId);
    }
    spinner.succeed(`成功删除 ${selectedGroups.length} 个分组`);

    return groupManagementMenu();
  } catch (error) {
    showError(error.message);
    return groupManagementMenu();
  }
}

async function backupManagementMenu() {
  await cleanupClosedBrowsers();
  printHeader('备份管理');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择操作',
      choices: [
        { name: '[1] 导入配置', value: 'import' },
        { name: '[2] 导出配置', value: 'export' },
        { name: '[3] 批量导入配置', value: 'batchImport' },
        { name: '[4] 批量导出分组', value: 'batchExportGroup' },
        { name: '[0] 返回主菜单', value: 'back' }
      ]
    }
  ]);

  switch(action) {
    case 'import': await importProfileMenu(); break;
    case 'export': await exportProfileMenu(); break;
    case 'batchImport': await batchImportProfilesMenu(); break;
    case 'batchExportGroup': await batchExportGroupsMenu(); break;
    case 'back': return showMainMenu();
  }
}

async function importProfileMenu() {
  try {
    const groups = await listGroups();

    const groupChoices = groups.length > 0 
      ? groups.map((g, i) => ({ name: `[${i+1}] ${g.name}`, value: g.id }))
      : [];
    groupChoices.push({ name: '[0] 无分组', value: '' });

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
      },
      {
        type: 'list',
        name: 'group',
        message: '选择分组',
        choices: groupChoices
      }
    ]);

    const spinner = ora('正在导入...').start();
    const content = readFileSync(answers.filename, 'utf-8');
    const config = JSON.parse(content);
    config.group = answers.group;
    await importProfile(answers.name, config);
    spinner.succeed('配置导入成功');

    return backupManagementMenu();
  } catch (error) {
    showError(error.message);
    return backupManagementMenu();
  }
}

async function exportProfileMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      printHeader('暂无配置');
      showError('没有可导出的配置');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return backupManagementMenu();
    }

    const { profileName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profileName',
        message: '选择要导出的配置',
        choices: profiles.map((p, i) => {
          const groupName = p.group ? groups.find(g => g.id === p.group)?.name : '-';
          return {
            name: `[${i+1}] ${p.name} [${groupName}]`,
            value: p.name
          };
        })
      }
    ]);

    const spinner = ora('正在导出...').start();
    const config = await exportProfile(profileName);
    const filename = `${profileName}.json`;
    writeFileSync(filename, JSON.stringify(config, null, 2));
    spinner.succeed(`配置已导出到: ${filename}`);

    return backupManagementMenu();
  } catch (error) {
    showError(error.message);
    return backupManagementMenu();
  }
}

async function batchImportProfilesMenu() {
  try {
    const groups = await listGroups();

    const groupChoices = groups.length > 0 
      ? groups.map((g, i) => ({ name: `[${i+1}] ${g.name}`, value: g.id }))
      : [];
    groupChoices.push({ name: '[0] 无分组', value: '' });

    const { fileCount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'fileCount',
        message: '要导入几个文件？',
        validate: (input) => !isNaN(input) && parseInt(input) > 0 ? true : '请输入有效数字'
      }
    ]);

    const files = [];
    for (let i = 0; i < parseInt(fileCount); i++) {
      const { filepath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'filepath',
          message: `文件 ${i+1} 的路径`,
          validate: (input) => input.trim() ? true : '路径不能为空'
        }
      ]);
      files.push(filepath);
    }

    const { group } = await inquirer.prompt([
      {
        type: 'list',
        name: 'group',
        message: '导入到分组',
        choices: groupChoices
      }
    ]);

    const spinner = ora('正在导入...').start();
    for (const filepath of files) {
      const content = readFileSync(filepath, 'utf-8');
      const config = JSON.parse(content);
      config.group = group;
      await importProfile(config.name, config);
    }
    spinner.succeed(`成功导入 ${files.length} 个配置`);

    return backupManagementMenu();
  } catch (error) {
    showError(error.message);
    return backupManagementMenu();
  }
}

async function batchExportGroupsMenu() {
  try {
    const groups = await listGroups();
    const profiles = await listProfiles();

    if (groups.length === 0) {
      printHeader('暂无分组');
      showInfo('没有分组可导出');
      await inquirer.prompt([{ type: 'input', name: 'proceed', message: '按 Enter 返回...' }]);
      return backupManagementMenu();
    }

    const { selectedGroups } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedGroups',
        message: '选择要导出的分组',
        choices: groups.map((g, i) => {
          const count = profiles.filter(p => p.group === g.id).length;
          return {
            name: `[${i+1}] ${g.name} (${count} 个配置)`,
            value: g.id
          };
        }),
        validate: (input) => input.length > 0 ? true : '至少选择一个分组'
      }
    ]);

    const spinner = ora('正在导出...').start();
    let exportCount = 0;
    for (const groupId of selectedGroups) {
      const groupProfiles = profiles.filter(p => p.group === groupId);
      for (const profile of groupProfiles) {
        const config = await exportProfile(profile.name);
        const filename = `${profile.name}.json`;
        writeFileSync(filename, JSON.stringify(config, null, 2));
        exportCount++;
      }
    }
    spinner.succeed(`成功导出 ${exportCount} 个配置 (来自 ${selectedGroups.length} 个分组)`);

    return backupManagementMenu();
  } catch (error) {
    showError(error.message);
    return backupManagementMenu();
  }
}

async function exitApp() {
  if (runningBrowsers.size > 0) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `有 ${runningBrowsers.size} 个浏览器仍在运行，确认退出?`,
        default: false
      }
    ]);

    if (!confirm) {
      return showMainMenu();
    }

    const spinner = ora('正在关闭浏览器...').start();
    for (const [name, context] of runningBrowsers) {
      try {
        await closeBrowser(context);
      } catch (error) {
        console.error(`关闭 ${name} 失败:`, error.message);
      }
    }
    spinner.succeed('已关闭所有浏览器');
  }

  console.log(colors.success('\n感谢使用浏览器配置管理器！再见！\n'));
  process.exit(0);
}

process.on('SIGINT', async () => {
  console.log('\n');
  if (runningBrowsers.size > 0) {
    const spinner = ora('正在关闭所有浏览器...').start();
    for (const [name, context] of runningBrowsers) {
      try {
        await closeBrowser(context);
      } catch (error) {
        console.error(`关闭 ${name} 失败:`, error.message);
      }
    }
    spinner.succeed('已退出');
  }
  process.exit(0);
});

showMainMenu();
