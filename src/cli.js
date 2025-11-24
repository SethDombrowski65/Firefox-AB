#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
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

let runningBrowsers = new Map();

function clearScreen() {
  console.clear();
}

function showHeader() {
  console.log(chalk.cyan.bold('\n╔══════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   浏览器配置管理器 v1.0.0          ║'));
  console.log(chalk.cyan.bold('╚══════════════════════════════════════╝\n'));
}

async function mainMenu() {
  clearScreen();
  showHeader();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '请选择操作:',
      choices: [
        { name: '📋 查看所有配置', value: 'list' },
        { name: '➕ 创建新配置', value: 'create' },
        { name: '▶️  打开配置', value: 'open' },
        { name: '🗑️  删除配置', value: 'delete' },
        { name: '✏️  编辑配置', value: 'edit' },
        { name: '📝 重命名配置', value: 'rename' },
        { name: '⭐ 星标管理', value: 'star' },
        { name: '📁 分组管理', value: 'groups' },
        { name: '🔄 重新生成指纹', value: 'fingerprint' },
        { name: '📤 导出配置', value: 'export' },
        { name: '📥 导入配置', value: 'import' },
        { name: '🗂️  批量操作', value: 'batch' },
        { name: '🔴 关闭浏览器', value: 'close' },
        { name: '❌ 退出', value: 'exit' }
      ]
    }
  ]);

  switch (action) {
    case 'list':
      await listProfilesMenu();
      break;
    case 'create':
      await createProfileMenu();
      break;
    case 'open':
      await openProfileMenu();
      break;
    case 'delete':
      await deleteProfileMenu();
      break;
    case 'edit':
      await editProfileMenu();
      break;
    case 'rename':
      await renameProfileMenu();
      break;
    case 'star':
      await starMenu();
      break;
    case 'groups':
      await groupsMenu();
      break;
    case 'fingerprint':
      await fingerprintMenu();
      break;
    case 'export':
      await exportMenu();
      break;
    case 'import':
      await importMenu();
      break;
    case 'batch':
      await batchMenu();
      break;
    case 'close':
      await closeBrowserMenu();
      break;
    case 'exit':
      console.log(chalk.green('\n再见！\n'));
      process.exit(0);
  }

  await mainMenu();
}

async function listProfilesMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const table = new Table({
      head: ['名称', '浏览器', '分组', '星标', '代理', '指纹', '使用次数'],
      style: { head: ['cyan'] }
    });

    profiles.forEach(profile => {
      const groupName = profile.group ? groups.find(g => g.id === profile.group)?.name || '-' : '-';
      table.push([
        runningBrowsers.has(profile.name) ? chalk.green('● ' + profile.name) : profile.name,
        profile.browserType === 'firefox' ? 'Firefox' : 'Chromium',
        groupName,
        profile.starred ? '⭐' : '',
        profile.proxy ? '✓' : '',
        profile.enableFingerprint !== false ? '✓' : '',
        profile.useCount || 0
      ]);
    });

    console.log('\n' + table.toString() + '\n');
    console.log(chalk.gray(`共 ${profiles.length} 个配置`));
    console.log(chalk.green('● 运行中') + '\n');

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function createProfileMenu() {
  try {
    const groups = await listGroups();

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '配置名称:',
        validate: input => input.trim() !== '' || '名称不能为空'
      },
      {
        type: 'list',
        name: 'browserType',
        message: '浏览器类型:',
        choices: [
          { name: 'Chromium', value: 'chromium' },
          { name: 'Firefox', value: 'firefox' }
        ]
      },
      {
        type: 'confirm',
        name: 'enableFingerprint',
        message: '启用指纹保护?',
        default: true
      },
      {
        type: 'list',
        name: 'group',
        message: '选择分组:',
        choices: [
          { name: '无分组', value: '' },
          ...groups.map(g => ({ name: g.name, value: g.id }))
        ]
      },
      {
        type: 'input',
        name: 'notes',
        message: '备注:'
      },
      {
        type: 'confirm',
        name: 'starred',
        message: '添加到星标?',
        default: false
      },
      {
        type: 'confirm',
        name: 'useProxy',
        message: '配置代理?',
        default: false
      }
    ]);

    let proxy = null;
    if (answers.useProxy) {
      const proxyAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'server',
          message: '代理地址:',
          validate: input => input.trim() !== '' || '代理地址不能为空'
        },
        {
          type: 'input',
          name: 'username',
          message: '用户名:'
        },
        {
          type: 'password',
          name: 'password',
          message: '密码:'
        }
      ]);

      if (proxyAnswers.server) {
        proxy = {
          server: proxyAnswers.server,
          username: proxyAnswers.username,
          password: proxyAnswers.password
        };
      }
    }

    const { startUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'startUrl',
        message: '启动URL:'
      }
    ]);

    const { customArgs } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customArgs',
        message: '自定义启动参数:'
      }
    ]);

    await createProfile(answers.name, {
      browserType: answers.browserType,
      enableFingerprint: answers.enableFingerprint,
      group: answers.group,
      notes: answers.notes,
      starred: answers.starred,
      proxy,
      startUrl,
      customArgs
    });

    console.log(chalk.green(`\n✓ 配置 "${answers.name}" 创建成功\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function openProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择要打开的配置:',
        choices: profiles.map(p => ({
          name: runningBrowsers.has(p.name) ? chalk.green('● ' + p.name) : p.name,
          value: p.name
        }))
      }
    ]);

    if (runningBrowsers.has(name)) {
      console.log(chalk.yellow(`\n配置 "${name}" 已在运行中\n`));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const profile = profiles.find(p => p.name === name);
    console.log(chalk.cyan(`\n正在启动 "${name}"...\n`));

    const { context } = await launchBrowser(profile.path, name);
    runningBrowsers.set(name, context);

    console.log(chalk.green(`✓ 浏览器已启动\n`));
    console.log(chalk.gray('提示: 浏览器将在后台运行，通过 "关闭浏览器" 菜单关闭\n'));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function closeBrowserMenu() {
  try {
    if (runningBrowsers.size === 0) {
      console.log(chalk.yellow('\n没有运行中的浏览器\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择要关闭的浏览器:',
        choices: Array.from(runningBrowsers.keys())
      }
    ]);

    const context = runningBrowsers.get(name);
    await closeBrowser(context);
    runningBrowsers.delete(name);

    console.log(chalk.green(`\n✓ 浏览器 "${name}" 已关闭\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function deleteProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择要删除的配置:',
        choices: profiles.map(p => p.name)
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除配置 "${name}"?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n已取消\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    await removeProfile(name);
    console.log(chalk.green(`\n✓ 配置 "${name}" 已删除\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function editProfileMenu() {
  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择要编辑的配置:',
        choices: profiles.map(p => p.name)
      }
    ]);

    const profile = profiles.find(p => p.name === name);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'group',
        message: '分组:',
        default: profile.group || '',
        choices: [
          { name: '无分组', value: '' },
          ...groups.map(g => ({ name: g.name, value: g.id }))
        ]
      },
      {
        type: 'input',
        name: 'notes',
        message: '备注:',
        default: profile.notes || ''
      },
      {
        type: 'input',
        name: 'proxyServer',
        message: '代理地址:',
        default: profile.proxy?.server || ''
      },
      {
        type: 'input',
        name: 'proxyUsername',
        message: '代理用户名:',
        default: profile.proxy?.username || ''
      },
      {
        type: 'password',
        name: 'proxyPassword',
        message: '代理密码:',
        default: profile.proxy?.password || ''
      },
      {
        type: 'input',
        name: 'startUrl',
        message: '启动URL:',
        default: profile.startUrl || ''
      },
      {
        type: 'input',
        name: 'customArgs',
        message: '自定义参数:',
        default: profile.customArgs || ''
      }
    ]);

    const updates = {
      group: answers.group,
      notes: answers.notes,
      startUrl: answers.startUrl,
      customArgs: answers.customArgs
    };

    if (answers.proxyServer) {
      updates.proxy = {
        server: answers.proxyServer,
        username: answers.proxyUsername,
        password: answers.proxyPassword
      };
    } else {
      updates.proxy = null;
    }

    await updateProfile(name, updates);
    console.log(chalk.green(`\n✓ 配置 "${name}" 已更新\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function renameProfileMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { oldName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'oldName',
        message: '选择要重命名的配置:',
        choices: profiles.map(p => p.name)
      }
    ]);

    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: '新名称:',
        validate: input => input.trim() !== '' || '名称不能为空'
      }
    ]);

    await renameProfile(oldName, newName);
    console.log(chalk.green(`\n✓ 配置已重命名: "${oldName}" → "${newName}"\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function starMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择配置:',
        choices: profiles.map(p => ({
          name: p.starred ? `⭐ ${p.name}` : p.name,
          value: p.name
        }))
      }
    ]);

    const profile = profiles.find(p => p.name === name);
    await updateProfile(name, { starred: !profile.starred });

    console.log(chalk.green(`\n✓ 配置 "${name}" ${profile.starred ? '已取消星标' : '已加星标'}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function groupsMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '分组管理:',
      choices: [
        { name: '📋 查看所有分组', value: 'list' },
        { name: '➕ 创建分组', value: 'create' },
        { name: '✏️  编辑分组', value: 'edit' },
        { name: '🗑️  删除分组', value: 'delete' },
        { name: '← 返回', value: 'back' }
      ]
    }
  ]);

  switch (action) {
    case 'list':
      await listGroupsMenu();
      await groupsMenu();
      break;
    case 'create':
      await createGroupMenu();
      await groupsMenu();
      break;
    case 'edit':
      await editGroupMenu();
      await groupsMenu();
      break;
    case 'delete':
      await deleteGroupMenu();
      await groupsMenu();
      break;
    case 'back':
      return;
  }
}

async function listGroupsMenu() {
  try {
    const groups = await listGroups();
    const profiles = await listProfiles();

    if (groups.length === 0) {
      console.log(chalk.yellow('\n暂无分组\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const table = new Table({
      head: ['分组名称', '颜色', '配置数量'],
      style: { head: ['cyan'] }
    });

    groups.forEach(group => {
      const count = profiles.filter(p => p.group === group.id).length;
      table.push([group.name, group.color, count]);
    });

    console.log('\n' + table.toString() + '\n');
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function createGroupMenu() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '分组名称:',
        validate: input => input.trim() !== '' || '名称不能为空'
      },
      {
        type: 'list',
        name: 'color',
        message: '颜色:',
        choices: [
          { name: '蓝色', value: 'blue' },
          { name: '绿色', value: 'green' },
          { name: '红色', value: 'red' },
          { name: '紫色', value: 'purple' },
          { name: '黄色', value: 'amber' },
          { name: '粉色', value: 'pink' },
          { name: '青色', value: 'cyan' }
        ]
      }
    ]);

    await createGroup(answers.name, answers.color);
    console.log(chalk.green(`\n✓ 分组 "${answers.name}" 创建成功\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function editGroupMenu() {
  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      console.log(chalk.yellow('\n暂无分组\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { id } = await inquirer.prompt([
      {
        type: 'list',
        name: 'id',
        message: '选择要编辑的分组:',
        choices: groups.map(g => ({ name: g.name, value: g.id }))
      }
    ]);

    const group = groups.find(g => g.id === id);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '分组名称:',
        default: group.name,
        validate: input => input.trim() !== '' || '名称不能为空'
      },
      {
        type: 'list',
        name: 'color',
        message: '颜色:',
        default: group.color,
        choices: [
          { name: '蓝色', value: 'blue' },
          { name: '绿色', value: 'green' },
          { name: '红色', value: 'red' },
          { name: '紫色', value: 'purple' },
          { name: '黄色', value: 'amber' },
          { name: '粉色', value: 'pink' },
          { name: '青色', value: 'cyan' }
        ]
      }
    ]);

    await updateGroup(id, answers);
    console.log(chalk.green(`\n✓ 分组已更新\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function deleteGroupMenu() {
  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      console.log(chalk.yellow('\n暂无分组\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { id } = await inquirer.prompt([
      {
        type: 'list',
        name: 'id',
        message: '选择要删除的分组:',
        choices: groups.map(g => ({ name: g.name, value: g.id }))
      }
    ]);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '确认删除此分组?',
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n已取消\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    await deleteGroup(id);
    console.log(chalk.green(`\n✓ 分组已删除\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function fingerprintMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择配置:',
        choices: profiles.map(p => p.name)
      }
    ]);

    await regenerateFingerprint(name);
    console.log(chalk.green(`\n✓ 配置 "${name}" 指纹已重新生成\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function exportMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { name } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        message: '选择要导出的配置:',
        choices: profiles.map(p => p.name)
      }
    ]);

    const config = await exportProfile(name);
    const filename = `${name}.json`;
    writeFileSync(filename, JSON.stringify(config, null, 2));

    console.log(chalk.green(`\n✓ 配置已导出到: ${filename}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function importMenu() {
  try {
    const { filename } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filename',
        message: '配置文件路径:',
        validate: input => input.trim() !== '' || '路径不能为空'
      }
    ]);

    const content = readFileSync(filename, 'utf-8');
    const config = JSON.parse(content);

    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: '配置名称:',
        default: config.name,
        validate: input => input.trim() !== '' || '名称不能为空'
      }
    ]);

    await importProfile(name, config);
    console.log(chalk.green(`\n✓ 配置 "${name}" 导入成功\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function batchMenu() {
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '批量操作:',
      choices: [
        { name: '🗑️  批量删除', value: 'delete' },
        { name: '📤 批量导出', value: 'export' },
        { name: '← 返回', value: 'back' }
      ]
    }
  ]);

  switch (action) {
    case 'delete':
      await batchDeleteMenu();
      break;
    case 'export':
      await batchExportMenu();
      break;
    case 'back':
      return;
  }
}

async function batchDeleteMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { names } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'names',
        message: '选择要删除的配置:',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    if (names.length === 0) {
      console.log(chalk.yellow('\n未选择配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认删除 ${names.length} 个配置?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\n已取消\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const results = await batchDeleteProfiles(names);
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(chalk.green(`\n✓ 成功删除 ${success} 个配置`));
    if (failed > 0) {
      console.log(chalk.red(`✗ 失败 ${failed} 个`));
    }
    console.log('');

    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

async function batchExportMenu() {
  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      console.log(chalk.yellow('\n暂无配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    const { names } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'names',
        message: '选择要导出的配置:',
        choices: profiles.map(p => ({ name: p.name, value: p.name }))
      }
    ]);

    if (names.length === 0) {
      console.log(chalk.yellow('\n未选择配置\n'));
      await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
      return;
    }

    for (const name of names) {
      const config = await exportProfile(name);
      const filename = `${name}.json`;
      writeFileSync(filename, JSON.stringify(config, null, 2));
    }

    console.log(chalk.green(`\n✓ 已导出 ${names.length} 个配置\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  } catch (error) {
    console.log(chalk.red(`\n错误: ${error.message}\n`));
    await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
  }
}

process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n正在关闭所有浏览器...'));
  for (const [name, context] of runningBrowsers) {
    try {
      await closeBrowser(context);
      console.log(chalk.green(`✓ ${name} 已关闭`));
    } catch (error) {
      console.log(chalk.red(`✗ ${name} 关闭失败`));
    }
  }
  console.log(chalk.green('\n再见！\n'));
  process.exit(0);
});

mainMenu();
