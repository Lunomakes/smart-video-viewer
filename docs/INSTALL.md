# 安装测试版 / Install the preview

[下载 v2.0.6 测试版 / Download v2.0.6 preview](https://github.com/Lunomakes/smart-video-viewer/releases/tag/v2.0.6)

## 中文

此版本仅提供 **Apple Silicon（M 系列芯片）** 包，不适用于 Intel Mac。工程最低部署目标为 macOS 12，但没有完成旧系统或另一台 Mac 的安装验证。

**这是未公证的开发测试包，使用 ad-hoc 临时签名，不是 Developer ID 发行签名，也不是 App Store 版本。** macOS 可能阻止启动；Safari 可能不会直接列出扩展。适合愿意按 Apple 开发测试流程配置的用户，不能保证下载即用。

1. 下载 `.dmg`，打开后将 **Smart Open in IINA.app** 拖到 **Applications**。也可下载 `.zip` 解压，把 App 放到应用程序目录。不要在磁盘映像中直接运行；已有同名 App 时由你决定是否替换。
2. 对照 Release 的 SHA256SUMS.txt 核验下载。只有确认来源可信且愿意运行未公证软件时，才按照 [Apple 的安全打开说明](https://support.apple.com/102445)处理单个 App 的提示；不需要全局关闭 Gatekeeper、SIP 或删除系统安全设置。
3. 此包用于 Safari 开发测试。在 Safari 设置 → 高级中显示开发者功能，再按 Apple 当前版本说明，在“开发”菜单选择 **允许未签名的扩展 / Allow Unsigned Extensions**。该选项扩大当前 Safari 会话可加载的扩展范围；仅用于你信任的测试扩展，重启 Safari 后可能需要重新启用。不愿改变此开发选项时，请改为自行配置 Xcode 签名构建，或等待正式发行版。
4. 打开配套 App，进入 Safari 扩展设置，启用 **Smart Open in IINA**，仅授予需要的网站访问权限。若系统仍不允许加载，请从源码用自己的 Xcode 签名配置构建；本项目不保证不同 Safari 版本均可直接加载该包。
5. 刷新视频页面，加载视频后点击“聚焦”图标，选择视频进入独立观影。跨域 iframe 还需授权嵌入域名。仅外部播放需要另外安装 IINA。

更新同名 App 后刷新网页。卸载时先在 Safari 禁用扩展，再将 App 移到废纸篓。安装包不会自动改变 Safari 网站权限或安全选项。

## English

This package is **Apple Silicon (M-series) only**, not Intel. The deployment target is macOS 12, but installation on older systems or a second Mac has not been verified.

**This is an unnotarized development preview with an ad-hoc signature, not Developer ID distribution signing or an App Store release.** macOS may block launch and Safari may not list the extension by default. It is intended for users willing to follow Apple’s development-testing setup, not guaranteed one-click installation.

1. Download the DMG and drag **Smart Open in IINA.app** to **Applications**, or extract the ZIP and move the app there. Do not run it inside the mounted image. Decide whether to replace any existing app yourself.
2. Verify the download against SHA256SUMS.txt. Only if you trust the source and accept running unnotarized software, follow [Apple’s app-opening guidance](https://support.apple.com/102445) for this specific app. Do not globally disable Gatekeeper or SIP.
3. For Safari development testing, expose developer features under Settings → Advanced, then use **Develop → Allow Unsigned Extensions**, following the instructions for your Safari version. This broadens which extensions the current Safari session can load; use it only for trusted testing. It may need reenabling after Safari restarts. If you do not want this developer setting, build from source with your own Xcode signing configuration or wait for a distribution-signed release.
4. Open the companion app, go to Safari extension settings, enable **Smart Open in IINA**, and authorize only intended websites. If Safari still refuses to load it, build from source with your own signing setup; this preview is not guaranteed to load across Safari versions.
5. Refresh the video page, let the player load, then use the Focus toolbar icon. Embedded cross-origin players need their own domain permission. IINA is only required for external playback.

Refresh pages after updating. To uninstall, disable the extension in Safari and move the app to Trash. The package does not automatically change Safari permissions or security settings.

## 官方资料 / Official references

- [Apple: Distributing your Safari web extension](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
- [Apple: Building a Safari app extension — unsigned development testing](https://developer.apple.com/documentation/safariservices/building-a-safari-app-extension)
- [Apple: Safely open apps on your Mac](https://support.apple.com/102445)
