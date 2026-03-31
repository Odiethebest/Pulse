# Pulse Drama Improvement 开发任务清单

## 1. 文档目的

本清单用于将 `Doc/pulse-drama-report-v2.md` 落地为可执行开发任务，按文件级别拆解后端和前端改造工作。

## 2. 版本目标

V2 目标是强化“吃瓜体验”，让用户快速看懂：

1. 在吵什么
2. 谁在吵
3. 吵到多凶
4. 是否可能反转

## 3. 任务拆分总览

## 3.1 Phase 1 体验先行

1. 报告结构升级
2. 证据绑定展示
3. 置信度分解可视化

## 3.2 Phase 2 算法增强

1. 立场识别
2. 冲突强度评分
3. 争议维度提取
4. 反转信号检测

## 3.3 Phase 3 稳定性与质量

1. 失败降级
2. 指标校准
3. 自动化测试覆盖

## 4. Backend 文件级任务

| 任务ID | 文件 | 类型 | 具体改动 | 完成标准 |
|---|---|---|---|---|
| B-001 | `backend/src/main/java/com/odieyang/pulse/model/PulseReport.java` | 修改 | 增加 V2 字段：`quickTake`、`dramaScore`、`polarizationScore`、`heatScore`、`flipRiskScore`、`confidenceBreakdown`、`campDistribution`、`controversyTopics`、`flipSignals`、`revisionDelta` | `/api/pulse/analyze` 返回包含新字段 |
| B-002 | `backend/src/main/java/com/odieyang/pulse/model/SentimentResult.java` | 修改 | 增加可选维度字段：`stanceDistribution`、`aspectSentiments` | 可被 `SentimentAgent` 解析并序列化 |
| B-003 | `backend/src/main/java/com/odieyang/pulse/model/CriticResult.java` | 修改 | 增加 `evidenceGaps`、`deltaHighlights` 字段，支持“修订差异”展示 | Critic 输出结构可稳定反序列化 |
| B-004 | `backend/src/main/java/com/odieyang/pulse/model/Quote.java` | 修改 | 增加 `camp`、`evidenceWeight` 字段 | 前端可直接显示“阵营+证据强度” |
| B-005 | `backend/src/main/java/com/odieyang/pulse/model/` | 新增 | 新增模型：`ConfidenceBreakdown.java`、`CampDistribution.java`、`ControversyTopic.java`、`FlipSignal.java` | 编译通过，JSON 输出字段稳定 |
| B-006 | `backend/src/main/java/com/odieyang/pulse/agent/StanceAgent.java` | 新增 | 新增立场识别 Agent，输出支持/反对/中立比例与代表论点 | 事件流可见 `StanceAgent STARTED/COMPLETED` |
| B-007 | `backend/src/main/java/com/odieyang/pulse/agent/ConflictAgent.java` | 新增 | 新增冲突强度 Agent，输出火药味评分与解释项 | 输出可用于 `heatScore` |
| B-008 | `backend/src/main/java/com/odieyang/pulse/agent/AspectAgent.java` | 新增 | 新增争议维度 Agent，输出维度热榜和摘要 | 报告有结构化 `controversyTopics` |
| B-009 | `backend/src/main/java/com/odieyang/pulse/agent/FlipRiskAgent.java` | 新增 | 新增反转检测 Agent，输出反转概率和信号列表 | 报告有 `flipRiskScore` 与 `flipSignals` |
| B-010 | `backend/src/main/java/com/odieyang/pulse/agent/SentimentAgent.java` | 修改 | 保留情绪比例能力，补充给下游 Agent 的结构化输入 | 不破坏现有字段兼容性 |
| B-011 | `backend/src/main/java/com/odieyang/pulse/agent/SynthesisAgent.java` | 修改 | 改为模板化输出，固定产出“三句速读 + 阵营对线 + 争议点 + 反转预警” | 输出稳定，空泛文本显著减少 |
| B-012 | `backend/src/main/java/com/odieyang/pulse/agent/CriticAgent.java` | 修改 | 增加证据缺口审计与修订前后差异总结 | `revisionDelta` 可用于前端模块 |
| B-013 | `backend/src/main/java/com/odieyang/pulse/orchestrator/PulseOrchestrator.java` | 修改 | 接入新 Agent 并行链路，计算 V2 四指标，组装新 `PulseReport` | 主流程成功率不下降 |
| B-014 | `backend/src/main/java/com/odieyang/pulse/service/AgentEventPublisher.java` | 修改 | 统一新增 Agent 事件命名规范，保证前端图谱可识别 | 前端节点状态准确 |
| B-015 | `backend/src/main/resources/application.properties` | 修改 | 增加 V2 阈值配置：冲突阈值、反转阈值、证据最小数 | 配置可热调整或重启生效 |
| B-016 | `backend/src/main/java/com/odieyang/pulse/controller/PulseController.java` | 修改 | 明确 V2 返回结构兼容策略，必要时加入 `version` 字段 | 新老前端可灰度兼容 |

## 5. Frontend 文件级任务

| 任务ID | 文件 | 类型 | 具体改动 | 完成标准 |
|---|---|---|---|---|
| F-001 | `frontend/src/App.jsx` | 修改 | 调整页面编排，第一屏展示 Drama 指标和三句速读，保留现有 Agent 图 | 主信息 10 秒可读 |
| F-002 | `frontend/src/hooks/usePulse.js` | 修改 | 适配 V2 报告字段，新增状态映射：`drama`, `polarization`, `heat`, `flipRisk` | 数据流无报错 |
| F-003 | `frontend/src/lib/api.js` | 修改 | 增加版本容错，支持 V1/V2 字段回退 | 接口兼容过渡期 |
| F-004 | `frontend/src/components/ConfidenceGauge.jsx` | 修改 | 保留但降级展示，增加分解入口跳转 | 用户理解分数来源 |
| F-005 | `frontend/src/components/SynthesisReport.jsx` | 修改 | 改为模板化渲染，优先展示“速读、争议、反转”区块 | 减少大段空泛文本 |
| F-006 | `frontend/src/components/QuoteCards.jsx` | 修改 | 增加阵营标签、证据强度、来源权重样式 | 神评卡信息密度提升 |
| F-007 | `frontend/src/components/SentimentChart.jsx` | 修改 | 扩展为情绪 + 阵营双视图 | 用户可切换阅读维度 |
| F-008 | `frontend/src/components/AgentGraph.jsx` | 修改 | 补充新 Agent 节点映射：`Stance`、`Conflict`、`Aspect`、`FlipRisk` | 节点状态与日志一致 |
| F-009 | `frontend/src/components/DramaScoreboard.jsx` | 新增 | 新增四核心指标卡片组件 | 第一屏直观看到“瓜味” |
| F-010 | `frontend/src/components/CampBattleBoard.jsx` | 新增 | 新增三阵营占比与代表观点组件 | 用户可直接看对线关系 |
| F-011 | `frontend/src/components/ControversyBoard.jsx` | 新增 | 新增争议维度热榜组件 | 可读出前 3 争议点 |
| F-012 | `frontend/src/components/RevisionDeltaPanel.jsx` | 新增 | 新增修订前后差异组件 | 用户看到“改了什么” |
| F-013 | `frontend/src/App.css` | 修改 | 为新模块补充布局和动效层级 | 不影响现有响应式 |
| F-014 | `frontend/src/index.css` | 修改 | 增加指标颜色变量和语义化 token | 视觉风格统一 |

## 6. 测试与质量任务

| 任务ID | 文件 | 类型 | 具体改动 | 完成标准 |
|---|---|---|---|---|
| T-001 | `backend/src/test/java/com/odieyang/pulse/controller/PulseControllerV2Tests.java` | 新增 | 覆盖 V2 报告字段契约 | 接口契约测试通过 |
| T-002 | `backend/src/test/java/com/odieyang/pulse/orchestrator/PulseOrchestratorV2Tests.java` | 新增 | Mock 新 Agent，验证并行编排与降级逻辑 | 主链路单元测试通过 |
| T-003 | `backend/src/test/java/com/odieyang/pulse/model/PulseReportSerializationTests.java` | 新增 | 验证 V2 JSON 序列化兼容性 | 字段无丢失 |
| T-004 | `frontend/src/components/__tests__/DramaScoreboard.test.jsx` | 新增 | 验证四核心指标显示和边界值 | 渲染测试通过 |
| T-005 | `frontend/src/hooks/__tests__/usePulseV2.test.js` | 新增 | 验证 V2 状态流、SSE 收敛和回退 | Hook 测试通过 |

## 7. 交付顺序

1. 第一步  
完成 `B-001` 到 `B-005`，先稳定数据结构。

2. 第二步  
完成 `B-006` 到 `B-013`，打通后端 V2 链路。

3. 第三步  
完成 `F-001` 到 `F-008`，前端先接通新字段并保持兼容。

4. 第四步  
完成 `F-009` 到 `F-014`，上线吃瓜体验模块。

5. 第五步  
完成 `T-001` 到 `T-005`，补齐自动化测试。

## 8. DoD

以下条件满足才算 V2 完成：

1. 报告首屏能直接展示四个核心指标。
2. 每条核心结论可追溯到引用证据。
3. 修订前后差异可视化可用。
4. 新 Agent 执行事件可完整显示在图谱中。
5. V2 结构在接口和前端渲染上均有自动化测试覆盖。
