# Browser Manager

<div align="center">

**多浏览器配置管理工具**

支持 Chromium 和 Firefox 的独立配置管理，内置指纹保护和代理配置

[下载](../../releases) · [使用指南](#使用) · [反馈问题](../../issues)

</div>

---

## 简介

Browser Manager 是一款基于 Electron 和 Playwright 的桌面应用，帮助你管理多个独立的浏览器配置。每个配置拥有完全隔离的数据存储，支持指纹伪装和代理设置，适合需要多账号管理、隐私保护的场景。

## 核心功能

- **多配置管理** - 创建、编辑、分组管理多个浏览器配置
- **完全隔离** - 每个配置独立存储 Cookies、缓存、Session
- **指纹保护** - Canvas、WebGL、音频指纹随机化
- **代理配置** - 支持 HTTP/HTTPS/SOCKS5 代理及认证
- **双浏览器** - 同时支持 Chromium 和 Firefox
- **现代界面** - 基于 Vue 3 的直观操作界面

## 安装

### 下载安装包

前往 [Releases](../../releases) 页面下载适合你系统的安装包：

- **Windows**: `Browser-Manager-Windows-Both-1.0.0.zip`
- **Linux**: `Browser-Manager-Linux-Both-1.0.0.zip`

解压后直接运行。

### 从源码运行

```bash
# 克隆项目
git clone https://github.com/user/Firefox-AB.git
cd Firefox-AB

# 安装依赖
pnpm install

# 启动应用
pnpm start
```

**环境要求**: Node.js 18+ 和 pnpm

## 使用

### 图形界面

启动应用后，你可以：

1. **仪表盘** - 查看统计信息、快速访问最近和收藏的配置
2. **配置管理** - 浏览、搜索、启动所有浏览器配置
3. **创建配置** - 配置浏览器类型、代理、启动参数等
4. **分组管理** - 用颜色和名称组织配置
5. **设置** - 调整应用首选项

### 命令行

```bash
# 创建配置
node src/cli.js create myProfile --browser firefox --fingerprint

# 启动浏览器
node src/cli.js open myProfile

# 列出所有配置
node src/cli.js list

# 删除配置
node src/cli.js remove myProfile
```

**更多命令**: 运行 `node src/cli.js --help` 查看完整文档

## 指纹保护

启用指纹保护后，会自动随机化以下浏览器特征：

- Canvas 渲染指纹
- WebGL 渲染器和供应商
- 音频上下文指纹
- 字体列表
- User-Agent
- 屏幕分辨率
- 时区和语言

## 数据存储

配置文件存储在 `~/.browser-manager/`:

```
~/.browser-manager/
├── data.db                    # SQLite 数据库
└── profiles/
    ├── profile1/             # 配置1的浏览器数据
    └── profile2/             # 配置2的浏览器数据
```

每个配置的浏览器数据完全独立，互不影响。

## 技术架构

- **Electron** - 跨平台桌面应用
- **Playwright** - 浏览器控制和自动化
- **Vue 3** - 响应式用户界面
- **sql.js** - 轻量级数据存储
- **Tailwind CSS** - 现代化样式

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm start

# 构建打包
pnpm build
```

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件
