# Crawler Relevance Tightening Strategy (16 High-Relevance Posts)

## 背景

当前抓取上限为 50 条后，数据覆盖量上去了，但噪音也显著增加，导致：

- 无关帖占比上升，主题桶被稀释。
- 前端展示中“有效证据密度”下降。
- Top 引用与结论稳定性变差。

核心问题不是“抓太少”，而是“质量门槛不足 + 保底留存过宽 + 合并排序未按相关度优先”。

## 目标

- 总量从 50 收紧到 16。
- 输出以“最强相关”优先，而不是“抓到就留”。
- 保留跨平台代表性，同时减少低信号噪音。

## 一、参数层快速收紧（当天可完成）

建议参数调整：

- `crawler.target-total=16`
- `tavily.max-results=4`
- `crawler.relevance.min-score=4`（从 2 提升）
- `crawler.relevance.min-retain-count=2`（从 6 下调）
- `crawler.relevance.min-retain-ratio=0.15`（从 0.35 下调）
- `crawler.relevance.max-hashtags=2`（从 4 下调）

预期效果：

- 降低每次抓取原始候选规模。
- 降低“为凑数保留低质量帖子”的概率。
- 更快达到高相关 Top-K。

## 二、筛选逻辑改造（关键）

文件：`backend/src/main/java/com/odieyang/pulse/orchestrator/PulseOrchestrator.java`

改造点：

1. 引入“强相关门槛”
- 保留条件建议为：`topic 精确命中` 或 `anchor 命中数 >= 2`。
- 对于仅命中 1 个弱锚点且无 topic 命中的帖子，直接过滤。

2. 平台内先排序后截断
- 在 `tightenCrawledPosts(...)` 中，按 relevance score 降序排序。
- 先取每个平台的高分候选（建议平台内先取 Top 8 作为上限）。
- 不再按原始返回顺序直接保留 `thresholdKept`。

3. 强化低信号剔除
- 继续保留已有 `LOW_SIGNAL_MARKERS` 机制。
- 对 hashtag 过多、营销模板、shell 文本保持硬拒绝策略。

## 三、合并策略改造（避免“先来先上”）

当前问题：

- `projectCrawledPosts(...)` 采用 interleave，再 dedupe，再 limit。
- 这会让中等相关但顺序靠前的内容进入最终结果。

改造建议：

- 平台各自拿到高分候选后，进入全局池。
- 全局池按统一 relevance priority 排序（可复用平台内 score）。
- 先 dedupe，再取全局 Top 16。
- 平台平衡规则：默认每平台最多 8 条；若一方不足，另一方补齐。

## 四、验收标准（必须量化）

1. 数量与覆盖
- `allPosts.size() <= 16`
- `crawlerStats.targetTotal == 16`

2. 相关性质量
- 无关帖（营销/壳页/泛娱乐噪音）明显下降。
- 主题桶内帖子与 topic 关键词一致性提升。

3. 稳定性
- 连续多次同 query 运行，Top 引用波动收敛。
- `Frontline Verdict` 的引用更贴近 query 核心语义。

## 五、测试与回归

新增/更新测试建议：

- `PulseOrchestratorV2Tests` 增加断言：
  - 最终帖子数不超过 16。
  - 低信号 marker 帖子不会进入 `allPosts`。
  - 至少保留一部分强相关帖子（关键词命中）。

回归检查：

- 不破坏现有 Phase3 crawler 指标输出结构。
- 不影响前端对 `crawlerStats/allPosts/topicBuckets` 的解析。

## 六、实施顺序

1. 先改参数（低风险、快速见效）。
2. 再改 `tightenCrawledPosts` 的门槛与排序逻辑。
3. 最后改 `projectCrawledPosts` 的全局 Top16 合并策略。
4. 跑后端全量测试 + 手动验证 3~5 个真实 query。
