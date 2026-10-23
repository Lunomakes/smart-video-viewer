# Focus Glass 应用图标

设计内容：沿用已确认的聚焦边框与播放符号，采用浅蓝白底、深蓝符号和透明玻璃镜片；深色外观使用浅蓝符号。Safari 工具栏的已确认单色图标不变。

- 原生母版：[FocusGlass.icon](FocusGlass.icon)，由 Xcode 直接编译，系统提供 Liquid Glass 效果。
- 符号沿用 `../focus-optical-2026-10-06/1-focus.svg` 的光学校正；图层整体缩放为 108%。
- [浅色预览](previews/default-1024.png)与[深色预览](previews/dark-1024.png)由 Xcode 27.1 随附的 Icon Composer `ictool` 导出。
- 配套应用的 `Resources/Icon.png` 使用同一浅色 1024px 导出，RGBA PNG；应用图标直接使用原生母版，未将网页渲染器打包进应用。
- 每次更改母版后重新导出预览和应用内 PNG，检查浅色、深色以及最终编译的全部 ICNS 尺寸。

参考：用户提供的 [Glass Icon Reveal](https://github.com/zanwei/glass-icon-reveal/tree/ac9e6fac240686ebd84861634bc4f8ec30556a3c) 与 [Apple App Icons HIG](https://developer.apple.com/design/human-interface-guidelines/app-icons)。前者仅作为视觉参考；图标使用本项目原创符号与 Apple 原生材质，没有复制其代码或示例商标。

在 Icon Composer 27.1 中，使用 `fill-specializations` 时不同时写 `fill`；未标注 appearance 的条目提供默认值，`dark` 条目提供深色覆盖。导出后必须检查实际颜色，不能仅验证 JSON 能被解析。
