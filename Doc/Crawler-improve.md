# Pulse Crawler 改造方案：全量真实抓取（上限 50）+ 主题归类

## 1. 背景与目标

当前 `Controversy Lenses` 的问题不是“主题能力不够”，而是“真实素材不足”，导致展示层曾经需要补齐策略。  
本方案目标是：

1. 以用户输入为中心，尽可能抓取更多真实帖子（Reddit + Twitter/X，合计上限 50）。
2. 抓取后再做主题归类，而不是先按主题去抓。
3. 前端只展示真实帖子，不生成伪评论。
4. 对抓取不足场景保持透明，明确显示 `x / 50` 与各主题样本数。

---

## 2. 核心原则

1. **真实性优先**：展示层不造文本，只用真实来源内容。
2. **抓取与分析解耦**：展示用全量真实帖；分析链路可按成本采样。
3. **Best-effort，不假承诺**：目标 50 条，但接受外部平台结果不足。
4. **可解释与可观测**：返回抓取覆盖、去重后数量、各主题分布与未归类数量。

---

## 3. 方案概览

### 3.1 新流程（建议）

1. 用户输入 topic。
2. QueryPlanner 生成多组查询（保留现有能力）。
3. Reddit/Twitter 抓取阶段扩容：聚合去重，合计最多保留 50 条真实帖子。
4. 主题抽取：从全量帖子提取 `controversyTopics`。
5. 主题归类：把每条帖子分配到 1~N 个主题桶（支持多标签）。
6. 报告输出：
   - 现有分析字段（兼容）
   - 新增全量抓取与主题桶字段（用于 `Controversy Lenses`）

### 3.2 与当前链路的关系

- 保留当前 `Sentiment/Stance/Conflict/FlipRisk/Synthesis/Critic` 主链路。
- 新增“抓取扩容 + 主题桶构建”作为独立输出层能力，不强耦合到生成文案质量。

---

## 4. 可行性评估

## 4.1 技术可行

可行。当前已有：

1. 多 query 抓取能力（RedditAgent/TwitterAgent）。
2. 结构化帖子模型（`RawPost` / `RawPosts`）。
3. 主题结构（`ControversyTopic`）。

补充改造主要是“数量策略 + 归类结构 + API 输出扩展”。

## 4.2 风险可控

主要风险：

1. Tavily 返回不足，无法凑够 50。
2. 全量喂给 LLM 成本与时延上升。
3. 主题归类边界模糊（一条帖可属于多个主题）。

应对策略：

1. 明确 best-effort 输出 `fetchedTotal` 与 `targetTotal`。
2. 分离“展示集”和“分析集”：展示集最多 50；分析集按预算采样。
3. 允许多标签归类，并返回 `unassigned` 桶。

---

## 5. 后端改造设计

## 5.1 抓取层改造

### 目标

将当前“小样本抓取”改成“聚合后上限 50”。

### 建议点

1. `TavilySearchService`
   - 支持可配置 `max_results`（例如 10）。
2. `RedditAgent` / `TwitterAgent`
   - 查询结果聚合后进行 URL 去重。
   - 每平台设置软上限（如 25），总上限由 Orchestrator 控制 50。
3. `PulseOrchestrator`
   - 合并平台数据后统一去重与截断（最多 50）。

## 5.2 新增模型（建议）

建议在 `model` 中增加：

1. `TopicBucket`
   - `topicId`
   - `topicName`
   - `posts: List<RawPost>`
2. `CrawlerStats`
   - `targetTotal`（固定 50）
   - `fetchedTotal`（实际抓到）
   - `redditCount`
   - `twitterCount`
   - `dedupedCount`
   - `unassignedCount`

并在 `PulseReport` 中新增可选字段：

1. `allPosts`（最多 50）
2. `topicBuckets`
3. `crawlerStats`

## 5.3 主题归类策略（建议两阶段）

### 第一阶段（低成本，先落地）

关键词/短语匹配：

1. 主题名分词后与 `title + snippet` 做匹配。
2. 命中阈值达到则归类。
3. 未命中进入 `unassigned`。

### 第二阶段（精度增强）

对第一阶段未命中或低置信边界样本，使用轻量 LLM 分类补充。

---

## 6. 前端改造设计

## 6.1 数据源切换

`Controversy Lenses` 改为优先使用后端返回的 `topicBuckets.posts`，不再从摘要 quote 派生。

## 6.2 透明化展示

在 UI 中新增：

1. 全局抓取进度：`Fetched 37 / 50`
2. 每主题样本计数：`Topic A (8)`
3. 未归类分组：`Unassigned`
4. 空桶提示：`No real posts matched this topic`

## 6.3 兼容策略

若后端尚未返回新字段：

1. 回退到当前 quote 渲染（仅真实 quote，不补造）。
2. 页面显示“limited source mode”提示。

---

## 7. 性能与成本策略

1. **展示集**：保留最多 50 条真实帖子。
2. **分析集**：按预算采样（例如 12~20 条）送入重模型。
3. **归类计算**：优先规则，LLM 兜底，避免每条帖都做高成本推理。
4. **超时控制**：抓取阶段设总时限，超时则返回当前已抓结果并标记不完整。

---

## 8. 实施计划（分步）

## Phase 1：真实抓取扩容（必做）

1. 后端聚合抓取上限改为 50（best-effort）。
2. `PulseReport` 输出 `allPosts + crawlerStats`。
3. 前端显示抓取计数。

## Phase 2：主题桶输出（必做）

1. 增加 `topicBuckets` 模型与归类逻辑（规则版）。
2. 前端 `Controversy Lenses` 切换为真实桶渲染。
3. 保留 `unassigned` 分组。

## Phase 3：分类精度与体验优化（增强）

1. 加入 LLM 边界归类。
2. 增加每桶排序（热度/时间/证据权重）。
3. 加入抓取覆盖监控与告警。

---

## 9. 验收标准（DoD）

1. `Controversy Lenses` 不包含任何模板生成文本。
2. API 返回真实抓取数量与目标数量（例如 `37 / 50`）。
3. 每个展示卡片可追溯到真实来源（平台 + URL 或来源标识）。
4. 主题分类完成后，UI 可展示每个主题的真实样本数。
5. 抓取不足时系统稳定降级，并在 UI 明确提示而非静默补造。

---

## 10. 结论

该方案可行，且是当前问题的直接解法。  
关键不是“保证每主题 6 条”，而是“优先保证 50 条真实样本池 + 透明分类 + 不造假展示”。  
在此基础上，再逐步提高分类准确率与抓取覆盖即可。

