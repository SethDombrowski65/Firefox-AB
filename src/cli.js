#!/usr/bin/env node

import blessed from 'blessed';
import contrib from 'blessed-contrib';
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

const screen = blessed.screen({
  smartCSR: true,
  title: '浏览器配置管理器'
});

screen.key(['escape', 'q', 'C-c'], function() {
  return process.exit(0);
});

function createBox(options) {
  return blessed.box({
    top: options.top || 'center',
    left: options.left || 'center',
    width: options.width || '50%',
    height: options.height || '50%',
    content: options.content || '',
    tags: true,
    border: {
      type: 'line'
    },
    style: {
      fg: 'white',
      bg: 'black',
      border: {
        fg: '#f0f0f0'
      }
    },
    label: options.label || ''
  });
}

function createList(options) {
  return blessed.list({
    top: options.top || 0,
    left: options.left || 0,
    width: options.width || '100%',
    height: options.height || '100%',
    keys: true,
    vi: true,
    mouse: true,
    border: {
      type: 'line'
    },
    style: {
      selected: {
        bg: 'blue',
        fg: 'white'
      },
      border: {
        fg: 'cyan'
      }
    },
    label: options.label || '',
    items: options.items || []
  });
}

function createForm(options) {
  const form = blessed.form({
    top: options.top || 'center',
    left: options.left || 'center',
    width: options.width || '60%',
    height: options.height || '60%',
    keys: true,
    vi: true,
    border: {
      type: 'line'
    },
    style: {
      border: {
        fg: 'cyan'
      }
    },
    label: options.label || ''
  });

  return form;
}

function showMessage(message, type = 'info') {
  const box = blessed.message({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 'shrink',
    height: 'shrink',
    border: {
      type: 'line'
    },
    style: {
      border: {
        fg: type === 'error' ? 'red' : type === 'success' ? 'green' : 'yellow'
      }
    },
    tags: true
  });

  box.display(message, 3, function() {
    screen.render();
  });
}

async function showMainMenu() {
  screen.children.forEach(child => child.destroy());

  const title = blessed.box({
    top: 0,
    left: 'center',
    width: '100%',
    height: 3,
    content: '{center}{bold}浏览器配置管理器 v1.0.0{/bold}{/center}',
    tags: true,
    style: {
      fg: 'cyan'
    }
  });

  const menu = createList({
    top: 3,
    left: 'center',
    width: '50%',
    height: '80%',
    label: ' 主菜单 ',
    items: [
      '📋 查看所有配置',
      '➕ 创建新配置',
      '▶️  打开配置',
      '🗑️  删除配置',
      '✏️  编辑配置',
      '📝 重命名配置',
      '⭐ 星标管理',
      '📁 分组管理',
      '🔄 重新生成指纹',
      '📤 导出配置',
      '📥 导入配置',
      '🗂️  批量删除',
      '🔴 关闭浏览器',
      '❌ 退出'
    ]
  });

  const help = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    content: ' ↑/↓: 移动 | Enter: 选择 | Esc/q: 退出',
    style: {
      fg: 'gray'
    }
  });

  screen.append(title);
  screen.append(menu);
  screen.append(help);

  menu.on('select', async function(item, index) {
    switch(index) {
      case 0:
        await showProfilesList();
        break;
      case 1:
        await showCreateProfile();
        break;
      case 2:
        await showOpenProfile();
        break;
      case 3:
        await showDeleteProfile();
        break;
      case 4:
        await showEditProfile();
        break;
      case 5:
        await showRenameProfile();
        break;
      case 6:
        await showStarManagement();
        break;
      case 7:
        await showGroupsMenu();
        break;
      case 8:
        await showRegenerateFingerprint();
        break;
      case 9:
        await showExportProfile();
        break;
      case 10:
        await showImportProfile();
        break;
      case 11:
        await showBatchDelete();
        break;
      case 12:
        await showCloseBrowser();
        break;
      case 13:
        process.exit(0);
    }
  });

  menu.focus();
  screen.render();
}

async function showProfilesList() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();
    const groups = await listGroups();

    const table = contrib.table({
      keys: true,
      vi: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: true,
      label: ' 配置列表 ',
      width: '100%',
      height: '90%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 2,
      columnWidth: [20, 10, 10, 5, 5, 5, 8]
    });

    const data = profiles.map(p => {
      const groupName = p.group ? groups.find(g => g.id === p.group)?.name || '-' : '-';
      const running = runningBrowsers.has(p.name) ? '●' : '';
      return [
        running + p.name,
        p.browserType === 'firefox' ? 'Firefox' : 'Chromium',
        groupName,
        p.starred ? '⭐' : '',
        p.proxy ? '✓' : '',
        p.enableFingerprint !== false ? '✓' : '',
        (p.useCount || 0).toString()
      ];
    });

    table.setData({
      headers: ['名称', '浏览器', '分组', '星标', '代理', '指纹', '使用次数'],
      data: data
    });

    const help = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ' Esc: 返回 | ● 运行中',
      style: { fg: 'gray' }
    });

    screen.append(table);
    screen.append(help);

    screen.key(['escape'], function() {
      showMainMenu();
    });

    table.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showCreateProfile() {
  screen.children.forEach(child => child.destroy());

  try {
    const groups = await listGroups();
    const form = createForm({
      label: ' 创建新配置 ',
      height: '90%'
    });

    let y = 1;

    blessed.text({
      parent: form,
      top: y++,
      left: 2,
      content: '配置名称:'
    });

    const nameInput = blessed.textbox({
      parent: form,
      top: y++,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' }
    });

    y++;

    blessed.text({
      parent: form,
      top: y++,
      left: 2,
      content: '浏览器类型: (c)hromium / (f)irefox'
    });

    const browserInput = blessed.textbox({
      parent: form,
      top: y++,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' }
    });

    y++;

    blessed.text({
      parent: form,
      top: y++,
      left: 2,
      content: '启用指纹: (y)es / (n)o'
    });

    const fingerprintInput = blessed.textbox({
      parent: form,
      top: y++,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' }
    });

    y++;

    blessed.text({
      parent: form,
      top: y++,
      left: 2,
      content: '代理地址:'
    });

    const proxyInput = blessed.textbox({
      parent: form,
      top: y++,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' }
    });

    y++;

    blessed.text({
      parent: form,
      top: y++,
      left: 2,
      content: '启动URL:'
    });

    const urlInput = blessed.textbox({
      parent: form,
      top: y++,
      left: 2,
      width: '90%',
      height: 3,
      inputOnFocus: true,
      border: { type: 'line' }
    });

    y++;

    const submitBtn = blessed.button({
      parent: form,
      top: y,
      left: 2,
      width: 12,
      height: 3,
      content: '创建',
      align: 'center',
      border: { type: 'line' },
      style: {
        bg: 'green',
        focus: { bg: 'lightgreen' }
      }
    });

    const cancelBtn = blessed.button({
      parent: form,
      top: y,
      left: 16,
      width: 12,
      height: 3,
      content: '取消',
      align: 'center',
      border: { type: 'line' },
      style: {
        bg: 'red',
        focus: { bg: 'lightred' }
      }
    });

    submitBtn.on('press', async function() {
      const name = nameInput.getValue();
      const browserType = browserInput.getValue().toLowerCase() === 'f' ? 'firefox' : 'chromium';
      const enableFingerprint = fingerprintInput.getValue().toLowerCase() !== 'n';
      const proxyServer = proxyInput.getValue();
      const startUrl = urlInput.getValue();

      if (!name) {
        showMessage('配置名称不能为空', 'error');
        return;
      }

      try {
        await createProfile(name, {
          browserType,
          enableFingerprint,
          proxy: proxyServer ? { server: proxyServer } : null,
          startUrl
        });

        showMessage('配置创建成功', 'success');
        setTimeout(() => showMainMenu(), 2000);
      } catch (error) {
        showMessage(`错误: ${error.message}`, 'error');
      }
    });

    cancelBtn.on('press', function() {
      showMainMenu();
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(form);
    nameInput.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showOpenProfile() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要打开的配置 ',
      items: profiles.map(p => 
        runningBrowsers.has(p.name) ? `● ${p.name}` : p.name
      )
    });

    list.on('select', async function(item, index) {
      const profile = profiles[index];

      if (runningBrowsers.has(profile.name)) {
        showMessage('该配置已在运行中', 'info');
        return;
      }

      try {
        showMessage(`正在启动 ${profile.name}...`, 'info');
        const { context } = await launchBrowser(profile.path, profile.name);
        runningBrowsers.set(profile.name, context);
        showMessage('浏览器已启动', 'success');
        setTimeout(() => showMainMenu(), 2000);
      } catch (error) {
        showMessage(`错误: ${error.message}`, 'error');
        setTimeout(() => showMainMenu(), 3000);
      }
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showDeleteProfile() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要删除的配置 ',
      items: profiles.map(p => p.name)
    });

    list.on('select', async function(item, index) {
      const name = profiles[index].name;

      const confirmBox = blessed.question({
        parent: screen,
        top: 'center',
        left: 'center',
        width: '50%',
        height: 'shrink',
        border: { type: 'line' },
        style: { border: { fg: 'red' } }
      });

      confirmBox.ask(`确认删除配置 "${name}"?`, async function(err, value) {
        if (value) {
          try {
            await removeProfile(name);
            showMessage('配置已删除', 'success');
            setTimeout(() => showMainMenu(), 2000);
          } catch (error) {
            showMessage(`错误: ${error.message}`, 'error');
            setTimeout(() => showMainMenu(), 3000);
          }
        } else {
          showMainMenu();
        }
      });
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showEditProfile() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要编辑的配置 ',
      items: profiles.map(p => p.name)
    });

    list.on('select', async function(item, index) {
      const profile = profiles[index];
      
      screen.children.forEach(child => child.destroy());

      const form = createForm({
        label: ` 编辑配置: ${profile.name} `,
        height: '80%'
      });

      let y = 1;

      blessed.text({
        parent: form,
        top: y++,
        left: 2,
        content: '代理地址:'
      });

      const proxyInput = blessed.textbox({
        parent: form,
        top: y++,
        left: 2,
        width: '90%',
        height: 3,
        value: profile.proxy?.server || '',
        inputOnFocus: true,
        border: { type: 'line' }
      });

      y++;

      blessed.text({
        parent: form,
        top: y++,
        left: 2,
        content: '启动URL:'
      });

      const urlInput = blessed.textbox({
        parent: form,
        top: y++,
        left: 2,
        width: '90%',
        height: 3,
        value: profile.startUrl || '',
        inputOnFocus: true,
        border: { type: 'line' }
      });

      y++;

      blessed.text({
        parent: form,
        top: y++,
        left: 2,
        content: '备注:'
      });

      const notesInput = blessed.textarea({
        parent: form,
        top: y++,
        left: 2,
        width: '90%',
        height: 5,
        value: profile.notes || '',
        inputOnFocus: true,
        border: { type: 'line' }
      });

      y += 4;

      const submitBtn = blessed.button({
        parent: form,
        top: y,
        left: 2,
        width: 12,
        height: 3,
        content: '保存',
        align: 'center',
        border: { type: 'line' },
        style: {
          bg: 'green',
          focus: { bg: 'lightgreen' }
        }
      });

      const cancelBtn = blessed.button({
        parent: form,
        top: y,
        left: 16,
        width: 12,
        height: 3,
        content: '取消',
        align: 'center',
        border: { type: 'line' },
        style: {
          bg: 'red',
          focus: { bg: 'lightred' }
        }
      });

      submitBtn.on('press', async function() {
        const proxyServer = proxyInput.getValue();
        const startUrl = urlInput.getValue();
        const notes = notesInput.getValue();

        try {
          await updateProfile(profile.name, {
            proxy: proxyServer ? { server: proxyServer } : null,
            startUrl,
            notes
          });

          showMessage('配置已更新', 'success');
          setTimeout(() => showMainMenu(), 2000);
        } catch (error) {
          showMessage(`错误: ${error.message}`, 'error');
        }
      });

      cancelBtn.on('press', function() {
        showMainMenu();
      });

      screen.key(['escape'], function() {
        showMainMenu();
      });

      screen.append(form);
      proxyInput.focus();
      screen.render();
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showRenameProfile() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要重命名的配置 ',
      items: profiles.map(p => p.name)
    });

    list.on('select', async function(item, index) {
      const oldName = profiles[index].name;

      screen.children.forEach(child => child.destroy());

      const form = createForm({
        label: ` 重命名: ${oldName} `,
        height: '30%'
      });

      blessed.text({
        parent: form,
        top: 2,
        left: 2,
        content: '新名称:'
      });

      const nameInput = blessed.textbox({
        parent: form,
        top: 3,
        left: 2,
        width: '90%',
        height: 3,
        inputOnFocus: true,
        border: { type: 'line' }
      });

      const submitBtn = blessed.button({
        parent: form,
        top: 7,
        left: 2,
        width: 12,
        height: 3,
        content: '确定',
        align: 'center',
        border: { type: 'line' },
        style: {
          bg: 'green',
          focus: { bg: 'lightgreen' }
        }
      });

      const cancelBtn = blessed.button({
        parent: form,
        top: 7,
        left: 16,
        width: 12,
        height: 3,
        content: '取消',
        align: 'center',
        border: { type: 'line' },
        style: {
          bg: 'red',
          focus: { bg: 'lightred' }
        }
      });

      submitBtn.on('press', async function() {
        const newName = nameInput.getValue();

        if (!newName) {
          showMessage('名称不能为空', 'error');
          return;
        }

        try {
          await renameProfile(oldName, newName);
          showMessage('配置已重命名', 'success');
          setTimeout(() => showMainMenu(), 2000);
        } catch (error) {
          showMessage(`错误: ${error.message}`, 'error');
        }
      });

      cancelBtn.on('press', function() {
        showMainMenu();
      });

      screen.key(['escape'], function() {
        showMainMenu();
      });

      screen.append(form);
      nameInput.focus();
      screen.render();
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showStarManagement() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 星标管理 ',
      items: profiles.map(p => p.starred ? `⭐ ${p.name}` : p.name)
    });

    list.on('select', async function(item, index) {
      const profile = profiles[index];

      try {
        await updateProfile(profile.name, { starred: !profile.starred });
        showMessage(`配置 ${profile.starred ? '已取消星标' : '已加星标'}`, 'success');
        setTimeout(() => showStarManagement(), 1000);
      } catch (error) {
        showMessage(`错误: ${error.message}`, 'error');
      }
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showGroupsMenu() {
  screen.children.forEach(child => child.destroy());

  const menu = createList({
    label: ' 分组管理 ',
    items: [
      '📋 查看所有分组',
      '➕ 创建分组',
      '✏️  编辑分组',
      '🗑️  删除分组',
      '← 返回'
    ]
  });

  menu.on('select', async function(item, index) {
    switch(index) {
      case 0:
        await showGroupsList();
        break;
      case 1:
        await showCreateGroup();
        break;
      case 2:
        await showEditGroup();
        break;
      case 3:
        await showDeleteGroup();
        break;
      case 4:
        showMainMenu();
        break;
    }
  });

  screen.key(['escape'], function() {
    showMainMenu();
  });

  screen.append(menu);
  menu.focus();
  screen.render();
}

async function showGroupsList() {
  screen.children.forEach(child => child.destroy());

  try {
    const groups = await listGroups();
    const profiles = await listProfiles();

    if (groups.length === 0) {
      showMessage('暂无分组', 'info');
      setTimeout(() => showGroupsMenu(), 2000);
      return;
    }

    const table = contrib.table({
      keys: true,
      vi: true,
      fg: 'white',
      selectedFg: 'white',
      selectedBg: 'blue',
      interactive: true,
      label: ' 分组列表 ',
      width: '100%',
      height: '90%',
      border: { type: 'line', fg: 'cyan' },
      columnSpacing: 3,
      columnWidth: [30, 15, 15]
    });

    const data = groups.map(g => {
      const count = profiles.filter(p => p.group === g.id).length;
      return [g.name, g.color, count.toString()];
    });

    table.setData({
      headers: ['分组名称', '颜色', '配置数量'],
      data: data
    });

    screen.key(['escape'], function() {
      showGroupsMenu();
    });

    screen.append(table);
    table.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showGroupsMenu(), 3000);
  }
}

async function showCreateGroup() {
  screen.children.forEach(child => child.destroy());

  const form = createForm({
    label: ' 创建分组 ',
    height: '40%'
  });

  blessed.text({
    parent: form,
    top: 2,
    left: 2,
    content: '分组名称:'
  });

  const nameInput = blessed.textbox({
    parent: form,
    top: 3,
    left: 2,
    width: '90%',
    height: 3,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  blessed.text({
    parent: form,
    top: 7,
    left: 2,
    content: '颜色: blue/green/red/purple/amber/pink/cyan'
  });

  const colorInput = blessed.textbox({
    parent: form,
    top: 8,
    left: 2,
    width: '90%',
    height: 3,
    value: 'blue',
    inputOnFocus: true,
    border: { type: 'line' }
  });

  const submitBtn = blessed.button({
    parent: form,
    top: 12,
    left: 2,
    width: 12,
    height: 3,
    content: '创建',
    align: 'center',
    border: { type: 'line' },
    style: {
      bg: 'green',
      focus: { bg: 'lightgreen' }
    }
  });

  const cancelBtn = blessed.button({
    parent: form,
    top: 12,
    left: 16,
    width: 12,
    height: 3,
    content: '取消',
    align: 'center',
    border: { type: 'line' },
    style: {
      bg: 'red',
      focus: { bg: 'lightred' }
    }
  });

  submitBtn.on('press', async function() {
    const name = nameInput.getValue();
    const color = colorInput.getValue() || 'blue';

    if (!name) {
      showMessage('分组名称不能为空', 'error');
      return;
    }

    try {
      await createGroup(name, color);
      showMessage('分组创建成功', 'success');
      setTimeout(() => showGroupsMenu(), 2000);
    } catch (error) {
      showMessage(`错误: ${error.message}`, 'error');
    }
  });

  cancelBtn.on('press', function() {
    showGroupsMenu();
  });

  screen.key(['escape'], function() {
    showGroupsMenu();
  });

  screen.append(form);
  nameInput.focus();
  screen.render();
}

async function showEditGroup() {
  screen.children.forEach(child => child.destroy());

  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      showMessage('暂无分组', 'info');
      setTimeout(() => showGroupsMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要编辑的分组 ',
      items: groups.map(g => g.name)
    });

    list.on('select', async function(item, index) {
      const group = groups[index];

      screen.children.forEach(child => child.destroy());

      const form = createForm({
        label: ` 编辑分组: ${group.name} `,
        height: '40%'
      });

      blessed.text({
        parent: form,
        top: 2,
        left: 2,
        content: '分组名称:'
      });

      const nameInput = blessed.textbox({
        parent: form,
        top: 3,
        left: 2,
        width: '90%',
        height: 3,
        value: group.name,
        inputOnFocus: true,
        border: { type: 'line' }
      });

      blessed.text({
        parent: form,
        top: 7,
        left: 2,
        content: '颜色:'
      });

      const colorInput = blessed.textbox({
        parent: form,
        top: 8,
        left: 2,
        width: '90%',
        height: 3,
        value: group.color,
        inputOnFocus: true,
        border: { type: 'line' }
      });

      const submitBtn = blessed.button({
        parent: form,
        top: 12,
        left: 2,
        width: 12,
        height: 3,
        content: '保存',
        align: 'center',
        border: { type: 'line' },
        style: {
          bg: 'green',
          focus: { bg: 'lightgreen' }
        }
      });

      const cancelBtn = blessed.button({
        parent: form,
        top: 12,
        left: 16,
        width: 12,
        height: 3,
        content: '取消',
        align: 'center',
        border: { type: 'line' },
        style: {
          bg: 'red',
          focus: { bg: 'lightred' }
        }
      });

      submitBtn.on('press', async function() {
        const name = nameInput.getValue();
        const color = colorInput.getValue();

        try {
          await updateGroup(group.id, { name, color });
          showMessage('分组已更新', 'success');
          setTimeout(() => showGroupsMenu(), 2000);
        } catch (error) {
          showMessage(`错误: ${error.message}`, 'error');
        }
      });

      cancelBtn.on('press', function() {
        showGroupsMenu();
      });

      screen.key(['escape'], function() {
        showGroupsMenu();
      });

      screen.append(form);
      nameInput.focus();
      screen.render();
    });

    screen.key(['escape'], function() {
      showGroupsMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showGroupsMenu(), 3000);
  }
}

async function showDeleteGroup() {
  screen.children.forEach(child => child.destroy());

  try {
    const groups = await listGroups();

    if (groups.length === 0) {
      showMessage('暂无分组', 'info');
      setTimeout(() => showGroupsMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要删除的分组 ',
      items: groups.map(g => g.name)
    });

    list.on('select', async function(item, index) {
      const group = groups[index];

      const confirmBox = blessed.question({
        parent: screen,
        top: 'center',
        left: 'center',
        width: '50%',
        height: 'shrink',
        border: { type: 'line' },
        style: { border: { fg: 'red' } }
      });

      confirmBox.ask(`确认删除分组 "${group.name}"?`, async function(err, value) {
        if (value) {
          try {
            await deleteGroup(group.id);
            showMessage('分组已删除', 'success');
            setTimeout(() => showGroupsMenu(), 2000);
          } catch (error) {
            showMessage(`错误: ${error.message}`, 'error');
            setTimeout(() => showGroupsMenu(), 3000);
          }
        } else {
          showGroupsMenu();
        }
      });
    });

    screen.key(['escape'], function() {
      showGroupsMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showGroupsMenu(), 3000);
  }
}

async function showRegenerateFingerprint() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择配置 ',
      items: profiles.map(p => p.name)
    });

    list.on('select', async function(item, index) {
      const name = profiles[index].name;

      try {
        await regenerateFingerprint(name);
        showMessage('指纹已重新生成', 'success');
        setTimeout(() => showMainMenu(), 2000);
      } catch (error) {
        showMessage(`错误: ${error.message}`, 'error');
      }
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showExportProfile() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = createList({
      label: ' 选择要导出的配置 ',
      items: profiles.map(p => p.name)
    });

    list.on('select', async function(item, index) {
      const name = profiles[index].name;

      try {
        const config = await exportProfile(name);
        const filename = `${name}.json`;
        writeFileSync(filename, JSON.stringify(config, null, 2));
        showMessage(`配置已导出到: ${filename}`, 'success');
        setTimeout(() => showMainMenu(), 3000);
      } catch (error) {
        showMessage(`错误: ${error.message}`, 'error');
      }
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showImportProfile() {
  screen.children.forEach(child => child.destroy());

  const form = createForm({
    label: ' 导入配置 ',
    height: '40%'
  });

  blessed.text({
    parent: form,
    top: 2,
    left: 2,
    content: '配置文件路径:'
  });

  const filenameInput = blessed.textbox({
    parent: form,
    top: 3,
    left: 2,
    width: '90%',
    height: 3,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  blessed.text({
    parent: form,
    top: 7,
    left: 2,
    content: '配置名称:'
  });

  const nameInput = blessed.textbox({
    parent: form,
    top: 8,
    left: 2,
    width: '90%',
    height: 3,
    inputOnFocus: true,
    border: { type: 'line' }
  });

  const submitBtn = blessed.button({
    parent: form,
    top: 12,
    left: 2,
    width: 12,
    height: 3,
    content: '导入',
    align: 'center',
    border: { type: 'line' },
    style: {
      bg: 'green',
      focus: { bg: 'lightgreen' }
    }
  });

  const cancelBtn = blessed.button({
    parent: form,
    top: 12,
    left: 16,
    width: 12,
    height: 3,
    content: '取消',
    align: 'center',
    border: { type: 'line' },
    style: {
      bg: 'red',
      focus: { bg: 'lightred' }
    }
  });

  submitBtn.on('press', async function() {
    const filename = filenameInput.getValue();
    const name = nameInput.getValue();

    if (!filename || !name) {
      showMessage('请填写完整信息', 'error');
      return;
    }

    try {
      const content = readFileSync(filename, 'utf-8');
      const config = JSON.parse(content);
      await importProfile(name, config);
      showMessage('配置导入成功', 'success');
      setTimeout(() => showMainMenu(), 2000);
    } catch (error) {
      showMessage(`错误: ${error.message}`, 'error');
    }
  });

  cancelBtn.on('press', function() {
    showMainMenu();
  });

  screen.key(['escape'], function() {
    showMainMenu();
  });

  screen.append(form);
  filenameInput.focus();
  screen.render();
}

async function showBatchDelete() {
  screen.children.forEach(child => child.destroy());

  try {
    const profiles = await listProfiles();

    if (profiles.length === 0) {
      showMessage('暂无配置', 'info');
      setTimeout(() => showMainMenu(), 2000);
      return;
    }

    const list = blessed.list({
      top: 0,
      left: 'center',
      width: '60%',
      height: '80%',
      keys: true,
      vi: true,
      mouse: true,
      border: { type: 'line' },
      style: {
        selected: { bg: 'blue', fg: 'white' },
        border: { fg: 'cyan' }
      },
      label: ' 批量删除 (Space选择, Enter确认) ',
      items: profiles.map(p => `[ ] ${p.name}`)
    });

    const selected = new Set();

    list.on('keypress', function(ch, key) {
      if (key.name === 'space') {
        const index = list.selected;
        const name = profiles[index].name;
        
        if (selected.has(name)) {
          selected.delete(name);
          list.items[index].content = `[ ] ${name}`;
        } else {
          selected.add(name);
          list.items[index].content = `[✓] ${name}`;
        }
        screen.render();
      }
    });

    list.on('select', async function() {
      if (selected.size === 0) {
        showMessage('未选择配置', 'info');
        return;
      }

      const confirmBox = blessed.question({
        parent: screen,
        top: 'center',
        left: 'center',
        width: '50%',
        height: 'shrink',
        border: { type: 'line' },
        style: { border: { fg: 'red' } }
      });

      confirmBox.ask(`确认删除 ${selected.size} 个配置?`, async function(err, value) {
        if (value) {
          try {
            await batchDeleteProfiles(Array.from(selected));
            showMessage(`成功删除 ${selected.size} 个配置`, 'success');
            setTimeout(() => showMainMenu(), 2000);
          } catch (error) {
            showMessage(`错误: ${error.message}`, 'error');
            setTimeout(() => showMainMenu(), 3000);
          }
        } else {
          showMainMenu();
        }
      });
    });

    screen.key(['escape'], function() {
      showMainMenu();
    });

    screen.append(list);
    list.focus();
    screen.render();
  } catch (error) {
    showMessage(`错误: ${error.message}`, 'error');
    setTimeout(() => showMainMenu(), 3000);
  }
}

async function showCloseBrowser() {
  screen.children.forEach(child => child.destroy());

  if (runningBrowsers.size === 0) {
    showMessage('没有运行中的浏览器', 'info');
    setTimeout(() => showMainMenu(), 2000);
    return;
  }

  const list = createList({
    label: ' 选择要关闭的浏览器 ',
    items: Array.from(runningBrowsers.keys())
  });

  list.on('select', async function(item, index) {
    const name = Array.from(runningBrowsers.keys())[index];
    const context = runningBrowsers.get(name);

    try {
      await closeBrowser(context);
      runningBrowsers.delete(name);
      showMessage('浏览器已关闭', 'success');
      setTimeout(() => showMainMenu(), 2000);
    } catch (error) {
      showMessage(`错误: ${error.message}`, 'error');
    }
  });

  screen.key(['escape'], function() {
    showMainMenu();
  });

  screen.append(list);
  list.focus();
  screen.render();
}

process.on('SIGINT', async () => {
  for (const [name, context] of runningBrowsers) {
    try {
      await closeBrowser(context);
    } catch (error) {
      console.error(`关闭 ${name} 失败`);
    }
  }
  process.exit(0);
});

showMainMenu();
