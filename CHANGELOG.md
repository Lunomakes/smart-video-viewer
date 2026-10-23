# 更新日志 / Changelog

依据现有源码与本地版本记录整理。这里的历史版本号不代表存在对应 Git 标签或 GitHub Release。
Compiled from source and local version records. Historical version numbers do not imply Git tags or GitHub Releases exist.

## Unreleased

- 2.0.7：更新扩展版本和构建号；检测请求增加超时，帧列表查询超时回退到主页面，避免弹窗一直停在检测中。 / Update extension and build versions; bound detection requests and fall back to the main frame if frame enumeration times out.

- 增加标准字幕轨道选择、关闭与本地 SRT / VTT 导入；退出时恢复网页设置。 / Add standard subtitle selection, off control and local SRT / VTT import; restore site settings on exit.
- 将媒体采集、暂停与 iframe 定位扩展到开放 Shadow DOM。 / Extend media collection, pausing and iframe lookup to open Shadow DOM.
- 为 X / Twitter 视频增加右上角快捷观影入口，保留原视频与播放进度；修复进入时意外暂停、页面布局恢复及画面外点击退出。 / Add a top-right viewer entry for X / Twitter videos while preserving the original player and progress; fix entry pauses, layout restoration and clicks outside the picture.
- 显示明确的视频标题和演员信息，缺失或不明确时不显示；缩小控制台，信息与控制台一起自动隐藏。 / Show explicit video titles and cast when available and unambiguous; compact the controls and hide video information with them.

- 清理源码个人标识与发布包构建路径；增加 CI 和打包隐私检查。 / Remove personal source identifiers and build paths from release binaries; add CI and packaging privacy checks.

- MIT 开源，补充中英文创作说明。 / Open source under MIT, with bilingual creation credits.

- 中英文 README、贡献/隐私/安全说明、问题和 PR 模板、开发与发布指南、本地自动检查及已启用的 GitHub Actions CI。
- Bilingual READMEs, contributor/privacy/security documentation, issue/PR templates, development/release guides, local automated checks and enabled GitHub Actions CI.

## 2.0.6 — 2026-10-06

- 修复工具栏小尺寸 PNG 重复、截断的导出问题；所有尺寸由已验证母版生成。
- Fix duplicated and clipped small toolbar PNG exports; derive all sizes from verified masters.

## 2.0.5 — 2026-10-06

- 采用确认的轻度光学校正稿；该版本小尺寸导出缺陷随后由 2.0.6 修复。
- Adopt the approved mild optical correction; small raster export defects were subsequently fixed in 2.0.6.

## 2.0.4 — 2026-10-06

- 引入“聚焦”图标 / Introduce the Focus icon.

## 2.0.3 — 2026-10-06

- 画面水平与垂直居中；点击画面外留白退出，控制台显隐不改变布局。
- Center the picture on both axes; exit on backdrop clicks; console visibility does not shift the picture.

## 2.0.0–2.0.2

- 网页独立观影、连续倍速、可配置跳转、控制台自动隐藏及玻璃风格；保留并修正 IINA 打开路径。
- In-page viewing, continuous rate control, configurable seeking, auto-hiding glass-style controls, and retained/fixed IINA launching.
