# Pulse V2 吃瓜体验与报告升级方案

## 1. 背景

当前 Pulse 已经具备完整分析链路，但用户感知偏平淡，常见反馈是：

1. 看得懂流程，但不够有意思。
2. 看到结论，但不知道“瓜点”在哪里。
3. 置信度有数字，但不理解这个数字的意义。

Pulse 的核心定位不是商务决策工具，而是让用户快速看懂网友争论，吃瓜更快、更香、更有料。

## 2. 目标与非目标

## 2.1 目标

1. 让用户在 10 秒内看懂事件“吵什么、谁在吵、吵多凶”。
2. 让每个结论都带证据链接，减少“AI 车轱辘话”感。
3. 保留可解释性，让用户理解分数和结论从哪里来。

## 2.2 非目标

1. 不把产品转型成严肃决策系统。
2. 不追求学术最优模型，优先体验可读性与稳定性。
3. 不引入复杂重平台架构，优先复用现有 Spring Boot + React 链路。

## 3. 报告体验改版

## 3.1 第一屏改造

将当前“单一 confidence”升级为四个直观指标：

1. 瓜味指数  
综合讨论量、冲突度、争议维度丰富度。

2. 撕裂度  
支持与反对阵营对立程度。

3. 火药味  
强情绪和攻击性表达强度。

4. 反转概率  
观点自相矛盾、证据不足、叙事不稳定的概率。

说明：`confidence` 保留，但降级为次要指标，放在详细解释区。

## 3.2 报告结构模板

固定输出结构，避免空泛长文：

1. 三句速读  
一句讲结论，一句讲主争议，一句讲反转风险。

2. 阵营对线图  
支持、反对、吃瓜三方占比与代表观点。

3. 争议点热榜  
按维度排序，例如价格、伦理、真实性、平台立场。

4. 神评 TOP 5  
每条都有原文片段、来源链接、阵营标签、情绪标签。

5. 反转预警  
列出可能翻车的证据缺口和叙事冲突点。

6. Critic 修订差异  
展示“修订前后”变化，不再只提示“已修订”。

## 4. 算法升级方向

## 4.1 立场识别

新增 `stance detection`，将内容分为：

1. 支持
2. 反对
3. 吃瓜中立

用于阵营可视化和撕裂度计算。

## 4.2 冲突强度评分

新增 `conflict scoring`，综合：

1. 对立词密度
2. 强情绪表达密度
3. 人身攻击或极端措辞占比

用于火药味指标。

## 4.3 争议维度提取

新增 `aspect-level controversy extraction`，把讨论归类到可读维度，替代笼统“正负面”。

## 4.4 反转信号检测

新增 `flip detection`，识别：

1. 互相矛盾的核心叙事
2. 证据不足却高强度结论
3. 高频转述但缺源头的信息

用于反转概率指标。

## 4.5 证据绑定机制

每个关键结论强制绑定：

1. 证据条数
2. 代表引用
3. 来源 URL

没有证据映射的结论，不进入最终摘要区。

## 5. 评分体系改造

## 5.1 展示层指标

面向用户展示：

1. 瓜味指数
2. 撕裂度
3. 火药味
4. 反转概率

## 5.2 内部置信度分解

内部 `confidence` 由可解释分项组成：

`confidence = 0.25 覆盖度 + 0.20 来源多样性 + 0.20 一致性 + 0.20 证据支撑 + 0.15 稳定性`

前端展示每个分项的加减分原因，而不是只显示一个总分。

## 6. 架构落地点

## 6.1 Backend 改造

建议新增模块：

1. `StanceAgent`
2. `ConflictAgent`
3. `AspectAgent`
4. `FlipRiskAgent`
5. `ScoreExplainerService`

已有模块调整：

1. `SentimentAgent` 输出从单一比例扩展为“情绪 + 阵营 + 维度”输入。
2. `SynthesisAgent` 改为模板化写作，优先输出固定区块。
3. `CriticAgent` 增加“证据缺口”与“修订差异”结构化返回。

## 6.2 Orchestrator 流程建议

1. Query 规划
2. Reddit 与 Twitter 并行抓取
3. Sentiment、Stance、Conflict、Aspect 并行计算
4. Synthesis 初稿
5. Critic 审核
6. 低分触发修订
7. 组装 V2 报告结构

## 6.3 前端模块建议

在现有组件基础上新增：

1. `DramaScoreboard`  
展示瓜味指数、撕裂度、火药味、反转概率。

2. `CampBattleBoard`  
展示三阵营比例和代表观点。

3. `ControversyBoard`  
展示争议维度热榜。

4. `HotTakeCards`  
展示神评 TOP 5 与来源。

5. `RevisionDeltaPanel`  
展示 Critic 修订前后差异。

保留现有：

1. `AgentGraph`
2. `LiveOutput`
3. `SentimentChart`

## 7. 数据结构建议

## 7.1 PulseReport V2 建议字段

```json
{
  "topic": "string",
  "quickTake": ["string", "string", "string"],
  "dramaScore": 0,
  "polarizationScore": 0,
  "heatScore": 0,
  "flipRiskScore": 0,
  "confidenceScore": 0,
  "confidenceBreakdown": {
    "coverage": 0,
    "diversity": 0,
    "agreement": 0,
    "evidenceSupport": 0,
    "stability": 0
  },
  "campDistribution": {
    "support": 0.0,
    "oppose": 0.0,
    "neutral": 0.0
  },
  "controversyTopics": [
    {
      "aspect": "string",
      "heat": 0,
      "summary": "string"
    }
  ],
  "topQuotes": [
    {
      "text": "string",
      "url": "string",
      "camp": "support|oppose|neutral",
      "sentiment": "positive|negative|neutral"
    }
  ],
  "flipSignals": ["string"],
  "synthesis": "string",
  "critique": {
    "unsupportedClaims": ["string"],
    "biasConcerns": ["string"],
    "revisionSuggestions": "string"
  },
  "revisionDelta": ["string"],
  "executionTrace": ["AgentEvent"]
}
```

## 8. 分阶段实施计划

## 8.1 Phase 1 体验先行

1. 新增报告模板和第一屏四指标展示。
2. 强制输出证据绑定卡片。
3. 保留现有算法，仅做轻量规则增强。

## 8.2 Phase 2 算法增强

1. 接入 stance、conflict、aspect、flip 四类结构化计算。
2. 上线 confidence 分解解释。
3. 优化 Critic 修订差异展示。

## 8.3 Phase 3 稳定性与调优

1. 指标校准与阈值调整。
2. 失败降级策略完善。
3. 可观测性补齐，支持线上诊断。

## 9. 验收标准

1. 用户能在第一屏明确读出争议主线。
2. 报告核心结论都有证据卡支撑。
3. 低置信度报告必须包含扣分原因。
4. 修订前后差异可见，不再是黑盒二次生成。
5. 用户主观反馈中“有料”“有瓜感”提升。

## 10. 风险与约束

1. 低质量引用会削弱可信度，需要严格 URL 过滤。
2. 高冲突议题可能出现敏感内容，需要前端内容降噪策略。
3. 指标过多会造成信息噪音，需要控制首屏密度。
4. 生成式描述必须受证据约束，避免夸张叙事。
