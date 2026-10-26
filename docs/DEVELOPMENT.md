# 开发与验证 / Development and verification

## 自动检查 / Automated checks

在仓库根目录，使用 Node.js 22+，无需安装 npm 依赖。
From the repository root, use Node.js 22+; no npm dependencies are required.

```sh
node scripts/check.mjs
node scripts/privacy-check.mjs
node --test "Smart Video Viewer/tests/"*.test.mjs
```

## Xcode

工程部署目标为 macOS 12.0；本机曾使用 Xcode 27 构建，最低 Xcode/Safari 组合尚未确认。使用支持该工程的 Xcode，先为两个 target 配置自己的签名团队。
The deployment target is macOS 12.0. Local builds used Xcode 27; the minimum Xcode/Safari combination is not verified. Use Xcode capable of opening the project and configure signing for both targets.

```sh
xcodebuild -project "Smart Video Viewer/Smart Open in IINA.xcodeproj"   -scheme "Smart Open in IINA" -configuration Release   -derivedDataPath output/build build
```

仅验证编译可附加 `CODE_SIGNING_ALLOWED=NO`；无签名构建成功不代表 Safari 可以加载。签名与实际启用是独立检查。
For compile-only checks, append `CODE_SIGNING_ALLOWED=NO`. An unsigned build does not establish that Safari can load it. Signing and runtime enablement require separate verification.

## 手动回归 / Manual regression

- 原视频不重载，进入/退出后进度保留；退出恢复原网页样式与倍速。 / Preserve the media element and time; restore page styling and prior rate on exit.
- 横/竖视频、不同窗口比例下居中；留白点击退出，画面点击播放/暂停。 / Center landscape/portrait video at different window ratios; distinguish backdrop and picture clicks.
- 控制台自动隐藏；快进快退不唤出，仅原区域悬停显示；输入框不触发快捷键。 / Check auto-hide, hover-only reveal, shortcut seeking and text-field exclusions.
- 检查 0.1× 步进、跳转秒数、无可跳转范围的直播、静音与恢复。 / Check rate increments, configured seeking, unseekable live media and mute.
- 有权限/无权限的 iframe、blob/MSE 媒体与开放 Shadow DOM。 / Check authorized/unauthorized frames, blob/MSE and open Shadow DOM.
- IINA 请求成功与实际播放分开记录，不使用带凭据的素材反馈。 / Record IINA launch and playback separately; redact credentials.
- 图标查看所有 PNG、浅深背景、实际 Safari 工具栏；遵循确认稿母版目录的说明。 / Inspect every PNG, light/dark backgrounds and the real Safari toolbar; follow the approved-master instructions.

`tests/*-checks.js` 为既有浏览器驱动函数，依赖特定 HTML、媒体素材和消息模拟；这些本地 fixture 未全部入库，不能当作独立 CLI 测试运行，暂未纳入 CI。`tests/serve.mjs` 仅提供 127.0.0.1:8766 测试服务器，不会自动生成 fixture。
The existing `tests/*-checks.js` files are browser-driver functions requiring specific HTML, media and message mocks. Those local fixtures are not fully tracked, so the functions are not standalone CLI tests and are not included in CI. `tests/serve.mjs` only serves local fixtures on 127.0.0.1:8766; it does not generate them.

## GitHub Actions CI

配置位于 [checks.yml](../.github/workflows/checks.yml)，推送 main 或创建/更新 PR 时自动运行。也可以进入 [Actions](https://github.com/Lunomakes/smart-video-viewer/actions) → Checks → Run workflow 手动运行。点击运行记录查看步骤日志；绿色表示通过，红色表示失败。
The configuration is in [checks.yml](../.github/workflows/checks.yml). It runs on pushes to main and pull requests. To run it manually, open [Actions](https://github.com/Lunomakes/smart-video-viewer/actions) → Checks → Run workflow. Open a run for step logs; green means success and red means failure.

CI 使用临时 Ubuntu 环境和 Node.js 22，仅需要仓库内容读取权限，不需要 Apple 签名证书或项目 Secrets。它执行静态检查和后台回归，不构建 macOS App，也不验证真实 Safari 播放或图标视觉效果。
CI uses an ephemeral Ubuntu runner and Node.js 22 with read-only repository permissions. No Apple signing certificates or project secrets are needed. It checks source/assets and background regressions, not macOS builds, actual Safari playback or visual icon quality.

## 字幕浏览器检查 / Subtitle browser checks

新增的 `Smart Video Viewer/tests/subtitle-fixture.html` 使用 Canvas 生成测试视频，无外部媒体和网站登录依赖。先在仓库根目录运行 `node "Smart Video Viewer/tests/serve.mjs"`，用 Playwright 打开 `http://127.0.0.1:8766/Smart%20Video%20Viewer/tests/subtitle-fixture.html`，再将 `subtitle-browser-checks.js` 作为 Playwright CLI 的 `run-code` 函数执行。截图输出到 `output/playwright/`。

The tracked subtitle fixture generates synthetic video with Canvas. Start the local server above, open the fixture in Playwright, and run `subtitle-browser-checks.js` through the CLI's `run-code`. It checks native tracks, SRT import, shadow discovery, hover-only controls, narrow layout and restoration. Browser checks use mocked extension messaging and are not Safari extension end-to-end tests.

## X 快捷观影 / X quick entry

`x-video.js` 仅在 X / Twitter 顶层页面运行，给已加载的视频添加右上角快捷入口，沿用原视频元素及现有观影控制。鼠标移入视频或键盘聚焦时显示；退出恢复页面；节点移除时清理入口。不包含连续刷视频，也不会请求 X API 或读取账户凭据。

启动上述本地服务器后，通过 Playwright CLI 的 `run-code` 执行 `tests/x-video-browser-checks.js`。驱动把合成测试页路由到 X 域名，验证域名限制、多视频精确选择、键盘进入、退出恢复、节点替换和页面生命周期；未登录真实 X 账户，不构成 Safari 真实信息流验收。截图位于 `output/playwright/x-quick-entry.png`。
