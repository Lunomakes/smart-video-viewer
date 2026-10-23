# 隐私说明 / Privacy

适用于当前 2.0.6 源码；这是一份代码行为说明，不是第三方网站或 IINA 的隐私承诺。
Applies to the current 2.0.6 source. This describes the extension, not the privacy practices of websites or IINA.

| 权限 / Permission | 用途 / Purpose |
| --- | --- |
| `<all_urls>`, `activeTab` | 在 Safari 授权范围内发现并控制网页视频 / Discover and control videos on authorized sites |
| `tabs`, `webNavigation` | 确定当前标签页和嵌入帧 / Identify the current tab and frames |
| `webRequest` | 观察请求 URL 以寻找媒体候选，不读取响应正文 / Observe request URLs for media candidates, not response bodies |
| `storage` | 本机保存播放偏好，并清理旧版媒体缓存 / Store local preferences and remove legacy stream caches |
| `nativeMessaging` | 将用户选择的 HTTP(S) 媒体 URL 交给配套 App，通过 IINA URL scheme 请求播放 / Pass a selected HTTP(S) media URL to the companion app for IINA playback |

当前代码没有遥测、分析 SDK 或开发者服务器上传逻辑。媒体 URL 可能携带临时访问凭据；后台仅在内存中保存候选，导航、标签页关闭或后台进程结束会使相应记录失效。升级迁移会删除旧版 `last-stream-v2-*` 持久缓存。Safari 自身与网站可能有独立存储或网络行为。

The current code has no telemetry, analytics SDK or upload path to a developer server. Media URLs can contain temporary credentials. Candidates are kept in background memory; navigation, tab closure or background process termination invalidates relevant records. Migration removes legacy persistent `last-stream-v2-*` entries. Safari and websites may have their own storage and network behavior.

选择外部播放会将 URL 传递给本机 IINA，IINA 会按自身行为请求远端资源。仅授权需要使用的网站；反馈问题前请遮盖私人信息，不提交实际签名 URL、Cookie 或完整浏览记录。

External playback passes the URL to local IINA, which requests remote resources according to its own behavior. Grant access only to intended sites. Redact private data from reports; do not submit signed URLs, cookies or browsing history.

## 本地字幕 / Local subtitles (unreleased)

本地字幕仅经用户选择后读取，转换为当前页面内的临时 WebVTT，并在退出观影时移除。扩展不上传文件、不持久保存字幕内容或文件名。字幕附加到原网页播放器，网站脚本可能读取轨道；这不是与网站隔离的私密文件查看器。

Local subtitles are read only after file selection, converted into temporary page-local WebVTT, and removed on viewer exit. The extension does not upload files or persist subtitle content or filenames. Tracks attach to the site's original video and may be read by page scripts; this is not a private viewer isolated from the site.
