# Pulse 系统 UIUX 重构执行指南

## 目标与约束
本次重构目标不是美化界面，而是重排信息优先级，让用户在前三秒看懂三件事：现在在吵什么，结论有多稳，证据是否足够。

设计约束如下：
1. 首屏优先呈现结论和可解释指标，不优先呈现系统执行过程。
2. 每个关键分数必须附带语义解释，不能只显示数字。
3. 同一信息只保留一个主展示位，避免重复陈述。
4. Critic 修订与证据缺口必须在正文中可见，而不是埋在尾部。

---

## 阶段一 信息架构重组

### 目标
建立倒金字塔阅读动线：Hero 结论 -> 信号看板 -> 核心争议 -> 证据与正文 -> 透明化细节。

### 需要修改的组件和代码
- `frontend/src/App.jsx`
  - 将首屏结构调整为：
    1. `SearchBar`
    2. `Hero Lead` 区域
    3. `Signal Dashboard` 区域
    4. 主内容区
  - 将 `AgentGraph` 和 `LiveOutput` 从主阅读流降级到可展开区域。
- `frontend/src/components/AgentGraph.jsx`
  - 保留组件能力，但改为只在抽屉中加载和显示。
- `frontend/src/components/LiveOutput.jsx`
  - 保留日志能力，但默认折叠，避免占据首屏高度。
- 新增 `frontend/src/components/GlobalRunStatus.jsx`
  - 顶部状态指示器，显示 `All Agents Completed`、`Running`、`Failed`。
- 新增 `frontend/src/components/AgentTraceDrawer.jsx`
  - 右侧抽屉容器，承载 `AgentGraph` 和 `LiveOutput`。
- `frontend/src/hooks/usePulse.js`
  - 增加派生状态，例如：
    - `agentSummary.runningCount`
    - `agentSummary.completedCount`
    - `agentSummary.failedCount`
    - `agentSummary.overallState`
- `frontend/src/App.css`
  - 新增抽屉层和顶部状态栏样式类。

### 验收标准
1. 默认首屏不显示执行图和日志详情。
2. 用户可通过状态指示器打开抽屉查看完整执行链路。
3. 首屏第一视觉焦点是结论而不是流程图。

---

## 阶段二 指标可视化翻译

### 目标
将分数转化为业务语言和风险语义，让用户理解分数含义与决策价值。

### 需要修改的组件和代码
- `frontend/src/components/DramaScoreboard.jsx`
  - 保留四核心指标，但每个指标必须包含：
    - 当前值
    - 档位标签
    - 一句话业务解释
  - 增加 `Snapshot -> Confidence` 映射区块。
- `frontend/src/components/ConfidenceGauge.jsx`
  - 显示总分档位，例如 `Low`、`Medium`、`High`。
  - 常显分项，不再隐藏在点击展开中。
- 新增 `frontend/src/components/ConfidenceRadar.jsx`
  - 使用雷达图呈现 `coverage`、`diversity`、`agreement`、`evidenceSupport`、`stability`。
- 新增 `frontend/src/lib/metricSemantics.js`
  - 统一维护阈值和文案映射，避免分散在多个组件中硬编码。
  - 输出函数建议：
    - `getMetricLevel(metricKey, score)`
    - `getConfidenceBand(score)`
    - `getMetricNarrative(metricKey, score)`
- `frontend/src/components/__tests__/DramaScoreboard.test.jsx`
  - 增加映射区域和语义标签断言。
- 新增 `frontend/src/components/__tests__/ConfidenceGauge.test.jsx`
  - 覆盖分数档位和分项展示。

### 验收标准
1. 用户无需猜测每个指标含义。
2. 用户可以直接看到分数为何高低。
3. Dashboard 与 Confidence 的关联路径在同一屏可读。

---

## 阶段三 模块去重与阅读动线净化

### 目标
减少重复信息，绑定观点与证据，提升报告可读性。

### 需要修改的组件和代码
- `frontend/src/components/CampBattleBoard.jsx`
  - 作为唯一阵营比例主展示组件。
  - 升级为横向堆叠条形图，支持悬停解释。
- `frontend/src/components/SynthesisReport.jsx`
  - 删除与 `CampBattleBoard` 重复的比例描述。
  - 保留观点与结论，不重复展示同一统计。
- `frontend/src/components/ControversyBoard.jsx`
  - 改为手风琴结构。
  - 每个争议项中内联展示平台标签与代表语录。
- `frontend/src/components/QuoteCards.jsx`
  - 支持按 `claimId` 与 `aspect` 联动过滤。
  - 增加平台标签视觉区分。
- `frontend/src/App.jsx`
  - 增加数据组装逻辑，把 `controversyTopics` 和 `representativeQuotes` 合并为统一展示模型。

### 验收标准
1. 同一阵营比例不在多个模块重复朗读。
2. 每个争议项可在一个交互单元内看到热度和代表观点。
3. 观点点击后能定位到对应证据。

---

## 阶段四 AI 透明度与可信度交互

### 目标
把 Critic 的修订和风险提示变成可见、可追溯、可解释的阅读体验。

### 需要修改的组件和代码
- `frontend/src/components/SynthesisReport.jsx`
  - 增加内联标注能力：
    - 被修订的句段带虚线下划线
    - 悬停显示 Critic 介入说明
  - 为证据不足段落增加 `Warning` 徽章。
- `frontend/src/components/RevisionDeltaPanel.jsx`
  - 从尾部静态列表升级为“正文锚点索引”。
  - 点击某条修订可跳转到正文对应位置。
- 新增 `frontend/src/components/InlineCriticNote.jsx`
  - 统一呈现 Critic 注释气泡样式。
- 新增 `frontend/src/components/RiskBadge.jsx`
  - 统一呈现证据缺口风险标签。
- `backend/src/main/java/com/odieyang/pulse/model/PulseReport.java`
  - 视前端需求可扩展字段：
    - `claimAnnotations`
    - `riskFlags`
    - `revisionAnchors`
- `backend/src/main/java/com/odieyang/pulse/orchestrator/PulseOrchestrator.java`
  - 在生成报告时补充上述结构化锚点数据。
- `backend/src/test/java/com/odieyang/pulse/orchestrator/PulseOrchestratorV2Tests.java`
  - 增加新字段的序列化和业务断言。

### 验收标准
1. 用户能在正文中看到哪些内容被 Critic 改过。
2. 用户能快速识别哪些结论证据不足。
3. 修订历史不再孤立在页面末尾。

---

## 建议任务拆分

### UX 001 信息架构
- 文件：
  - `frontend/src/App.jsx`
  - `frontend/src/components/GlobalRunStatus.jsx`
  - `frontend/src/components/AgentTraceDrawer.jsx`
  - `frontend/src/hooks/usePulse.js`
  - `frontend/src/App.css`

### UX 002 可解释看板
- 文件：
  - `frontend/src/components/DramaScoreboard.jsx`
  - `frontend/src/components/ConfidenceGauge.jsx`
  - `frontend/src/components/ConfidenceRadar.jsx`
  - `frontend/src/lib/metricSemantics.js`
  - `frontend/src/components/__tests__/DramaScoreboard.test.jsx`

### UX 003 去重与联动
- 文件：
  - `frontend/src/components/CampBattleBoard.jsx`
  - `frontend/src/components/ControversyBoard.jsx`
  - `frontend/src/components/QuoteCards.jsx`
  - `frontend/src/components/SynthesisReport.jsx`
  - `frontend/src/App.jsx`

### UX 004 透明化增强
- 文件：
  - `frontend/src/components/SynthesisReport.jsx`
  - `frontend/src/components/RevisionDeltaPanel.jsx`
  - `frontend/src/components/InlineCriticNote.jsx`
  - `frontend/src/components/RiskBadge.jsx`
  - `backend/src/main/java/com/odieyang/pulse/model/PulseReport.java`
  - `backend/src/main/java/com/odieyang/pulse/orchestrator/PulseOrchestrator.java`
  - `backend/src/test/java/com/odieyang/pulse/orchestrator/PulseOrchestratorV2Tests.java`

---

## 交付定义
满足以下条件即视为 UIUX 重构完成：
1. 首屏以结论和可解释指标为中心，不以执行流程为中心。
2. Signal Dashboard 的每个指标都有语义解释和阈值状态。
3. Confidence 分数与分项结构有可视化映射关系。
4. 阵营和争议信息不重复，观点可追溯到证据。
5. Critic 修订和风险缺口在正文中可视化呈现。
