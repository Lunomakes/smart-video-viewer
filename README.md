# Smart Video Viewer

[English](README.en.md) · 简体中文

<img src="design/focus-optical-2026-10-06/approved-raster/icon-512.png" width="88" height="88" alt="聚焦：四角取景框和播放三角形">

在 Safari 中专注观看网页视频：居中放大原有播放器，压暗网页，提供连续倍速与可自定义秒数的快进快退；也可请求使用 IINA 打开媒体。

**当前源码版本：2.0.7（尚未发布）。** Safari 和配套 App 中仍使用名称 **Smart Open in IINA**。这是独立的社区项目，不隶属于 Apple 或 IINA，也不调用 Safari 内置 Video Viewer 的私有接口。

## 功能

- 原网页内独立观影：视频按原始比例水平、垂直居中，保留原有 video 元素和播放进度。
- 0.1–16× 连续调速；滑块、数字输入箭头和快捷键每次调整 0.1×，数字框可直接输入其他数值。
- 自定义快进快退 N 秒：默认 5 秒，范围 0.1–600 秒。
- 玻璃风格控制台：进入后自动隐藏；仅鼠标回到控制台区域才显示，快捷键不会唤出。
- 点击画面播放／暂停，点击画面外留白或按 Esc 退出。
- 在已获网站权限的情况下，检测跨域 iframe 与开放 Shadow DOM 内的视频。
- 保留“在 IINA 中打开”、浏览器原生画中画和全屏入口。

玻璃控制台由 CSS 实现，并非原生 Liquid Glass 控件。当前界面文案主要为中文；英文 README 不代表已有英文界面。

## 源码新增功能（尚未发布）

- 字幕菜单提供“跟随网页”、关闭及语言选择，支持标准字幕轨道，包括网站动态加载的 WebVTT。
- 可导入 UTF-8 SRT / VTT（最多 5 MB），仅用于本次观影，退出时移除。扩展不上传字幕；字幕附加到网页播放器后，网页脚本可能读取。
- 视频采集、暂停和嵌入帧定位统一支持开放 Shadow DOM。仍需先让原网页加载出视频，并授权嵌入播放器域名。

这些更改不包含在下方现有 v2.0.6 下载包中。已用本地合成视频验证标准字幕交互；真实网站在 Safari 中的完整播放兼容性尚未确认。网页自绘字幕、封闭播放器及加载失败的字幕源仍不保证支持；本地字幕还可能受网站内容安全策略限制。

## 获取与构建

现提供 [v2.0.6 测试版 DMG / ZIP](https://github.com/Dashmett/smart-video-viewer/releases/tag/v2.0.6)，仅支持 **Apple Silicon**。这是临时签名、未公证的开发测试包，需要 Safari 开发测试配置，不能保证下载即用；详见[安装说明](docs/INSTALL.md)。尚无 Developer ID 正式发行包或 App Store 版本。

也可以按以下步骤从源码构建：

需要 macOS、Safari 和 Xcode。工程部署目标为 macOS 12.0，但这不是完整兼容性承诺：目前主要在本机 macOS 27 / Safari 环境验证，更早版本尚未完成实机覆盖。IINA 仅在使用外部播放功能时需要。

1. 克隆仓库：

   ```sh
   git clone https://github.com/Dashmett/smart-video-viewer.git
   cd smart-video-viewer
   open "Smart Video Viewer/Smart Open in IINA.xcodeproj"
   ```

2. 在 Xcode 为 App 和 Extension 两个 target 选择自己的 Signing Team；如提示标识符冲突，调整两者的 Bundle Identifier。工程保留了本机开发配置，你需要自己的有效签名配置。
3. 选择 **Smart Open in IINA** scheme 和 **My Mac**，构建运行。
4. 在配套 App 打开 Safari 扩展设置，启用 **Smart Open in IINA**，只授权需要使用的网站。
5. 刷新视频网页，让播放器加载，再点击工具栏图标、选择视频并进入独立观影。跨域嵌入播放器需要同时授权其域名。

签名及发行方式参见 [Apple：创建 Safari Web Extension](https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension) 和 [发行指南](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)。

## 快捷键

仅适用于网页内独立观影；编辑输入框或使用系统组合键时不拦截。

| 按键 | 操作 |
| --- | --- |
| ← / J，→ / L | 快退 / 快进 N 秒 |
| 空格 / K | 播放 / 暂停 |
| [ / ] | 减少 / 增加 0.1× |
| R | 恢复 1× |
| M | 静音 / 取消静音 |
| F | 原生全屏 |
| Esc | 退出独立观影 |

退出时恢复进入前的网页布局、原生控制栏和倍速。默认倍速与跳转秒数可在弹窗设置；进入后可在控制台调整。详见[使用与兼容性说明](Smart%20Video%20Viewer/Smart%20Open%20in%20IINA%20Extension/Resources/README.md)。

## 权限与隐私

扩展申请网站访问、标签页、帧导航、网络请求观察、设置存储及与本机 App 通信等权限，用于发现视频、协调嵌入播放器和启动 IINA。`<all_urls>` 允许适配不同网站，但实际访问仍由 Safari 的授权控制。

当前代码没有分析统计、广告 SDK 或开发者数据上传服务。设置保存在本机；捕获的媒体地址保存在后台内存中，导航时清除、进程结束后丢失，不持久保存带签名的媒体地址。点击 IINA 入口时会将所选媒体 URL 交给本机 IINA，后者可能访问对应媒体服务器。详见[隐私说明](PRIVACY.md)。

## 已知限制

- 不绕过 DRM、付费墙或网站授权；依赖 Cookie、Referer 或短期签名的媒体不一定能在 IINA 播放。
- “已请求 IINA 打开”表示系统调用已发出，不代表播放成功。
- 关闭的 Shadow DOM、Canvas 视频、强制替换 video 的网站可能不兼容；网页绘制在 video 外的字幕、弹幕与菜单不会自动提取。
- 倍速范围最终由浏览器和媒体决定；极端倍速可能静音、卡顿或被网站重置。
- 原生全屏、画中画由 Safari 管理，自定义控制台和快捷键不保证在这些窗口中生效。
- 不提供 Chrome、Firefox、iOS 或 iPadOS 安装包。

## 开发与验证

Node.js 22 或更新版本可运行无需第三方依赖的检查：

```sh
node scripts/check.mjs
node scripts/privacy-check.mjs
node --test "Smart Video Viewer/tests/"*.test.mjs
```

[GitHub Actions](.github/workflows/checks.yml) 会在推送到 main、创建或更新 PR 时自动运行，也可在仓库 Actions → Checks → Run workflow 手动触发。这两项检查覆盖脚本语法、资源引用、版本一致性与后台回归，**不等同于 Safari 实机端到端验证**。Xcode 构建与手动测试见[开发指南](docs/DEVELOPMENT.md)。

## 项目结构

```text
Smart Video Viewer/     Xcode 工程、网页扩展、配套 App 与检查脚本
design/                 图标提案、确认稿与已验证导出母版
scripts/                可复现的静态检查
.github/                问题模板与 PR 模板
```

[贡献指南](CONTRIBUTING.md) · [行为准则](CODE_OF_CONDUCT.md) · [安全报告](SECURITY.md) · [更新日志](CHANGELOG.md) · [发布检查](docs/RELEASING.md)

## 创作说明

**代码由 Codex 和色批驱动力完成。**

## 许可证

本项目以 [MIT License](LICENSE) 开源。允许使用、修改、商用和再分发，须保留版权与许可声明；软件按原样提供，不作担保。来源与授权范围见[授权说明](docs/LICENSING.md)。
