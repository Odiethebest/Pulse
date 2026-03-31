# Pulse UIUX 设计规范（当前版）

Last updated: 2026-03-31

## 1. 目标与体验基线

Pulse 的 UIUX 目标不是“炫”，而是让用户在最短时间回答三件事：

1. 现在在吵什么（Frontline Verdict）
2. 结论有多稳（Confidence + Flip risk）
3. 证据是否可信（Controversy + Data Integrity）

## 2. 信息架构（报告页）

推荐阅读顺序：

1. SearchBar（输入与重试入口）
2. Frontline Verdict（首结论 + 核心引用）
3. Signal 区（Drama/Polarization/Heat/Flip + confidence breakdown）
4. Controversy 区（主题桶 + 代表观点）
5. Synthesis + Data Integrity（Critic 透明化）
6. 底部动作（Share / New Query）

约束：

- 不在首屏优先展示执行过程细节。
- 不重复讲同一指标（同一事实只有一个主展示位）。

## 3. 交互设计规范

### 3.1 引用与证据

- `Frontline Verdict` 必须可点/可追踪到来源。
- 证据优先展示“相关性高 + 信息量高”的来源，不按固定序号模板。
- `Data Integrity` 区作为可信度防线，必须可见、可展开、可追溯。

### 3.2 加载态与可见性

- 加载态展示“系统正在做什么”，但不劫持最终报告阅读动线。
- 日志与执行树应可折叠/切换，避免窄屏信息噪声。

### 3.3 底部动作区（移动端重点）

- 底部固定操作条不能遮挡 `Data Integrity` 或报告末尾关键信息。
- 页面内容必须预留底部滚动安全空间（content bottom padding）。
- 桌面端与移动端定位策略分离，避免相互回归。

## 4. 移动端与桌面端隔离原则

### 4.1 组件隔离

- `AgentTheaterLoadingDesktop` 与 `AgentTheaterLoadingMobile` 分离维护。
- 移动端行为策略（自动滚动、布局、折叠）不应通过桌面组件条件分支硬塞。

### 4.2 样式隔离

- 移动端加载态样式使用 `.theater-mobile-*` 命名空间。
- 不在移动端修复中修改桌面关键结构类名。

### 4.3 行为隔离

- 移动端可采用双行日志、聚焦执行摘要、可展开全链路。
- 桌面端保留宽屏结构和信息密度，不被移动端策略牵连。

## 5. 视觉与可读性约束

1. 关键文本必须支持窄屏换行与长词断行（`break-word`）。
2. 强调层级通过排版与对比，而不是堆叠大色块。
3. 徽章/告警颜色要与语义一致：
   - 绿色：通过/稳定
   - 黄色：风险/待补证据
   - 灰色：中性/未知

## 6. UI 变更验收清单

每次 UI 改动，至少验证：

1. 移动端 iPhone 常见宽度下，无底部遮挡。
2. 桌面端主布局结构无变化（必要时用结构断言测试）。
3. 引用点击/来源映射未退化。
4. Data Integrity 区可见且可操作。
5. `npm test` 与 `npm run build` 通过。
