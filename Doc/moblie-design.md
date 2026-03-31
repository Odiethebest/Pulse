# Pulse Mobile UI Optimization Plan (Agent Theater)

## 1) 背景与目标

当前手机端加载态（`Agent workflow + Pulse Console`）存在明显可用性问题：

- 需要上下滚动才能同时看到执行链和日志，信息流断裂。
- 底部 `Stop capture` 悬浮按钮遮挡日志末尾，关键状态不可见。
- 日志一行包含 `time/status/agent/message` 多列，在窄屏强制换行后可读性差。

目标是按 HCI 原则重构手机端加载态，同时**严格隔离桌面端**，不影响现有桌面体验与布局。

---

## 2) 已通读的移动端相关代码清单

### 核心加载链路

- `frontend/src/App.jsx`
  - 加载态 `showLoadingTheater` 的入口。
  - 手机端/桌面端共用 `AgentTheaterLoading`。
  - 底部固定 `Stop capture` 按钮（`fixed bottom-32 sm:bottom-8`）。
- `frontend/src/components/AgentTheaterLoading.jsx`
  - 当前是单组件同时承担 mobile/desktop。
  - 手机端是“执行树 + 日志”上下堆叠（嵌套滚动）。
  - `Execution Tree` 有 `max-h-48 overflow-y-auto`。
  - `Pulse Console` 固定 `h-[320px]`，自动滚动始终强制到底。
- `frontend/src/App.css`
  - 抽屉样式、全局层级、背景层。
  - 无移动端专门安全区（safe area）处理。

### 会影响移动端可视高度/滚动的外围模块

- `frontend/src/components/SearchBar.jsx`
- `frontend/src/components/ControversyAccordion.jsx`（移动端 sticky 头+横向滚动 chips）
- `frontend/src/components/DramaScoreboard.jsx`（`md:hidden`/`hidden md:grid` 双布局）
- `frontend/src/components/SynthesisReport.jsx`（移动端折叠）
- `frontend/src/components/CampBattleBoard.jsx`
- `frontend/src/components/SentimentChart.jsx`
- `frontend/src/components/QuoteCards.jsx`
- `frontend/src/index.css` / `frontend/src/App.css`

### 当前测试覆盖（与本问题直接相关）

- 有组件单测：`ControversyAccordion / DramaScoreboard / SemanticSourceChip / QuoteCards ...`
- 暂无针对 `AgentTheaterLoading` 的移动端布局与滚动行为测试（这是本次需要补的空白）。

---

## 3) HCI 诊断（为什么现在体验差）

### 3.1 认知负荷过高（Cognitive Load）

- 手机上同屏并列两个高密度任务区（执行树 + 日志）会造成频繁上下切换焦点。
- 用户主要任务其实是“确认是否在跑 + 看最新日志”，但 UI 把次级信息也强制展示。

### 3.2 可见性与反馈不足（Visibility of System Status）

- 最新日志可能被底部浮层遮挡，导致“系统状态不可见”。
- 执行树和日志都可滚动，用户难以判断自己在看哪一层状态。

### 3.3 控制权不足（User Control and Freedom）

- 日志自动滚动是强制的，用户想回看历史时会被抢焦点。

### 3.4 响应式策略不完整（Responsive Adaptation）

- 当前仅依赖 `md:` 样式差异，没有移动端信息架构拆分（IA split）。
- 320~430 宽度下多列日志模式天然不可读。

---

## 4) 设计原则（本次改造遵循）

1. Mobile First 的任务聚焦：默认只让用户看一个主任务面板。
2. Progressive Disclosure：次级信息折叠，不与主日志争夺首屏。
3. 单滚动上下文：移动端同一时刻只保留一个纵向主滚动容器。
4. 安全区优先：底部操作与日志末尾永不遮挡（`env(safe-area-inset-bottom)`）。
5. 桌面端零回归：桌面结构与视觉保持不变。

---

## 5) 移动端/桌面端隔离策略（关键）

### 5.1 组件级隔离，不在一个组件里硬塞双逻辑

建议拆分：

- `AgentTheaterLoadingDesktop.jsx`（承接当前桌面布局，保持原状）
- `AgentTheaterLoadingMobile.jsx`（新移动端 IA）
- `AgentTheaterLoading.jsx` 仅做路由：
  - `isMobile ? <Mobile /> : <Desktop />`

### 5.2 样式命名空间隔离

- 新增 `.theater-mobile-*` 类，仅在 mobile 组件使用。
- 不改动现有桌面类名和布局规则，避免连带影响。

### 5.3 行为隔离

- 自动滚动策略、日志行排版、底部操作区改造仅在 Mobile 组件内实现。
- Desktop 维持当前 `md:flex-row` 结构与视觉。

### 5.4 验证隔离

- 增加桌面快照/结构断言测试，确保 desktop 结构不变。

---

## 6) 分步执行计划（可直接按阶段落地）

## Phase 1: 快速止血（1 天）

目标：先解决“看不全日志”和“遮挡”。

改动：

- 移动端日志容器高度改为基于视口：`height: calc(100dvh - header - search - controls)`。
- 日志区底部增加 `padding-bottom: calc(84px + env(safe-area-inset-bottom))`。
- 日志行在移动端改成两行：
  - 第一行：`time + status + agent`
  - 第二行：`message` 全宽
- `Stop capture` 调整为不遮挡内容（建议顶部 sticky；若保留底部固定，必须预留空间）。

验收：

- iPhone 12/13/14 宽度下，最新日志完整可见，无截断遮挡。
- 不需要滚动执行树才能看到日志主信息。

---

## Phase 2: 信息架构重排（1~2 天）

目标：从“上下堆叠双任务”改为“单主任务”。

改动：

- 移动端引入 segmented tabs：
  - `Console`（默认）
  - `Execution`
- `Console` 作为默认首屏，`Execution` 提供摘要+可展开完整链路。
- 顶部保留紧凑状态条：Done / Running / Failed。

验收：

- 用户首屏进入即可读到日志，不需要先滚动到 console 区。
- 执行链仍可访问，但不干扰主任务。

---

## Phase 3: 交互细节优化（1 天）

目标：提升可控性与流畅度。

改动：

- 自动滚动仅在“用户位于底部阈值内”时触发。
- 用户离开底部时出现 `Jump to latest` 按钮。
- `Execution` 树默认展示 running + 最近完成，点击“Show all steps”展开。

验收：

- 回看历史日志时不被强制拉回底部。
- 新日志到来时，用户有明确方式跳回最新。

---

## Phase 4: 回归门禁与质量保障（1 天）

目标：避免改坏桌面端，建立长期护栏。

新增测试：

- `AgentTheaterLoading` mobile:
  - 默认 tab 为 Console
  - 日志两行布局渲染
  - 自动滚动仅在底部触发
  - 有 `Jump to latest` 行为
- `AgentTheaterLoading` desktop:
  - 仍为双列布局（Execution + Console）
  - 桌面 class 结构不变

手测矩阵：

- iPhone SE / iPhone 13 / Pixel 7 / iPad mini / Desktop 1440。
- Safari/Chrome 的 `100vh` vs `100dvh` 差异验证。

---

## 7) 具体文件改造建议（按优先顺序）

1. `frontend/src/components/AgentTheaterLoading.jsx`
2. `frontend/src/components/AgentTheaterLoadingMobile.jsx`（新增）
3. `frontend/src/components/AgentTheaterLoadingDesktop.jsx`（新增）
4. `frontend/src/App.jsx`（仅保留调用，不加 desktop 风险逻辑）
5. `frontend/src/App.css`（新增 mobile namespaced 样式，不改 desktop 规则）
6. `frontend/src/components/__tests__/...`（新增 mobile/desktop 分流测试）

---

## 8) 桌面端保护清单（必须执行）

- 不修改 desktop 视觉 token（间距、字号、色板）。
- 不改 `md:` 以上的布局分配（除非明确 bug）。
- 每次提交前跑全量前端测试 + 桌面人工回归截图对比。
- 若出现 desktop 差异，优先回退到 mobile namespaced 样式，不在共享 class 上修补。

---

## 9) Definition of Done

1. 手机端加载态不再需要上下反复滚动才能读日志。  
2. 日志末尾不会被底部操作区遮挡。  
3. 自动滚动行为可控，不抢用户回看。  
4. 桌面端布局与交互无感知变化。  
5. 新增测试覆盖 mobile/desktop 分流与关键滚动行为。  
