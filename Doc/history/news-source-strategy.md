# Pulse 新闻源扩展方案（仅使用 Tavily）

## 1. 目标

在不新增其他采集供应商的前提下，仅基于 Tavily 为 Pulse 增加新闻站点数据源，提升事件分析的覆盖面、时效性和可解释性。

## 2. 范围

本方案只覆盖公开新闻网页内容，不覆盖登录态、付费墙内页、社交媒体私域内容。

## 3. 方案原则

1. 先稳定后扩展，优先保证可持续运行。
2. 先结构化检索，再正文抽取，最后按需深爬。
3. 只采集公开信息，明确白名单和限流策略。
4. 所有新增能力都要可观测，可回溯，可降级。

## 4. Tavily 能力映射

1. Search  
用于跨新闻站检索候选链接，核心控制项是 `include_domains`。

2. Extract  
用于从候选链接提取正文内容，作为情感分析和综合报告输入。

3. Map  
用于获取站点 URL 结构，辅助发现专题页、频道页。

4. Crawl  
用于站内定向抓取，适合热点事件期间的深度补采。

## 5. 推荐执行路径

### 阶段 A：搜索优先

1. 由查询规划阶段生成 `newsQueries`。
2. 调用 Tavily Search，限定新闻白名单域名。
3. 返回候选链接、标题、摘要、来源域名。

### 阶段 B：正文抽取

1. 对阶段 A 的 URL 批量调用 Tavily Extract。
2. 将正文、发布时间、作者和站点信息标准化。
3. 过滤正文过短或抽取失败的结果。

### 阶段 C：按需深挖

1. 当事件热度高或覆盖不足时，启用 Map 和 Crawl。
2. Crawl 只针对白名单站点和限定路径，限制深度与并发。
3. 深挖结果与阶段 A、B 结果统一去重后入库。

## 6. 与现有 Pulse 架构的对接

## 6.1 Agent 层

建议新增两个组件：

1. `NewsAgent`  
负责 Tavily Search 检索新闻链接。

2. `NewsExtractAgent`  
负责 Tavily Extract 抽取正文并标准化字段。

## 6.2 Orchestrator 层

建议在 `PulseOrchestrator` 中扩展并行流程：

1. 查询规划后并行拉取 Reddit、Twitter、News。
2. News 数据进入与社媒一致的情感分析链路。
3. 综合阶段加入“社媒与新闻差异”对比段落。

## 6.3 Model 层

建议补充或扩展字段：

1. `RawPost` 增加 `sourceDomain`、`publishedAt`、`author`。
2. `RawPosts` 支持 `platform = news`。
3. `PulseReport` 增加可选 `newsSentiment` 与 `newsCoverageSummary`。

## 7. 数据质量策略

1. URL 标准化  
移除追踪参数，统一协议和尾斜杠策略。

2. 去重  
优先 URL 去重，次级使用标题与正文哈希去重。

3. 时间标准化  
统一为 ISO-8601，无法解析时标记为空并降低权重。

4. 来源分级  
按域名可靠性和内容完整度设定权重。

## 8. 白名单建议

初始白名单建议：

1. `reuters.com`
2. `apnews.com`
3. `npr.org`
4. `theverge.com`
5. `techcrunch.com`
6. `arstechnica.com`

后续按抽取成功率、更新频率和误报率动态调整。

## 9. 限额与成本控制

1. Search 按主题限量返回，避免一次性大批查询。
2. Extract 仅处理高价值候选 URL。
3. Crawl 默认关闭，仅在策略命中时启用。
4. 增加按主题、按站点、按时间窗的预算上限。

## 10. 合规与风险

1. 仅处理公开网页与公开链接。
2. 遵守目标站点条款与 robots 策略。
3. 不做反爬绕过，不处理登录态内容。
4. 明确版权边界，报告中优先存引用和摘要。

## 11. 实施里程碑

1. M1  
完成 `NewsAgent`，打通 Search 检索与事件流上报。

2. M2  
完成 `NewsExtractAgent`，落地正文抽取、清洗和去重。

3. M3  
将 news 数据接入情感分析、综合报告与前端展示。

4. M4  
灰度启用 Map 和 Crawl，增加预算控制与监控告警。

## 12. 验收标准

1. 指定主题下可稳定返回新闻来源结果。
2. 抽取成功率达到目标阈值。
3. 报告可展示新闻情感与社媒差异结论。
4. 请求失败可自动降级，不阻塞主流程。
5. 关键链路有日志、事件和指标可追踪。

## 13. 参考

1. Tavily Search  
https://docs.tavily.com/documentation/api-reference/endpoint/search

2. Tavily Extract  
https://docs.tavily.com/documentation/api-reference/endpoint/extract

3. Tavily Crawl  
https://docs.tavily.com/documentation/api-reference/endpoint/crawl

4. Tavily Rate Limits  
https://docs.tavily.com/documentation/rate-limits

5. Include Domains 说明  
https://help.tavily.com/articles/9712346824-controlling-search-results-with-include-and-exclude-domains
