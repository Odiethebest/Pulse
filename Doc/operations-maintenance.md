# Pulse 运营与维护手册

Last updated: 2026-03-31

## 1. 运行前提

基础依赖：

1. Java 21
2. Node.js 22.12+
3. OpenAI API Key
4. Tavily API Key

关键配置文件：

- `backend/src/main/resources/application.properties`
- `backend/.env`（本地）

## 2. 日常运行命令

本地开发：

1. Backend：`cd backend && ./mvnw spring-boot:run`
2. Frontend：`cd frontend && npm run dev`

生产构建（单体产物）：

1. `cd backend && ./mvnw clean package`
2. `cd backend/target && java -jar pulse-*.jar`

说明：

- Maven 构建阶段会自动执行前端 `npm install` 与 `npm run build`，并将 `frontend/dist` 复制到后端静态目录。

## 3. 健康检查与观测点

### 3.1 HTTP 检查

1. `GET /api/actuator/health`
2. `POST /api/pulse/analyze`
3. `GET /api/pulse/stream`

### 3.2 关键日志信号（后端）

- `Starting analysis for topic...`
- `Relevance filter tightened ...`
- `QuickTake Phase2 guard adjusted citation pairing ...`
- `Analysis complete ...`
- `... failed and fallback is used ...`

### 3.3 关键业务指标（报告内）

- `crawlerStats.coveragePercent`
- `crawlerStats.coverageLevel`
- `crawlerStats.unassignedCount`
- `crawlerStats.redditCount / twitterCount`

## 4. 参数治理（当前推荐基线）

Crawler 质量参数：

- `CRAWLER_TARGET_TOTAL=16`
- `TAVILY_MAX_RESULTS=4`
- `CRAWLER_RELEVANCE_MIN_SCORE=4`
- `CRAWLER_RELEVANCE_MIN_RETAIN_COUNT=2`
- `CRAWLER_RELEVANCE_MIN_RETAIN_RATIO=0.15`
- `CRAWLER_RELEVANCE_MAX_HASHTAGS=2`
- `CRAWLER_RELEVANCE_PLATFORM_CAP=8`

质量门控参数：

- `debate.confidence.threshold=60`
- `debate.quality.min-density=55`
- `debate.quality.min-claim-coverage=60`

## 5. 常见故障与处置

### 5.1 Tavily 返回质量差或配额受限

症状：

- 抓取样本不足、噪音升高、`coverageLevel=warning/critical`

处理：

1. 检查 `TAVILY_API_KEY` 与配额。
2. 检查 `TAVILY_MAX_RESULTS` 和 query 粒度。
3. 观察 `hardRejected/strictRejected` 日志判断是否门槛过严。

### 5.2 OpenAI 调用失败或超时

症状：

- 分析失败、或 fallback 输出增多。

处理：

1. 检查 `OPENAI_API_KEY` 与模型可用性。
2. 验证网络出口与请求限流。
3. 保留降级策略，不直接关闭 Critic/Rewrite 流程。

### 5.3 前端连接异常（SSE/接口）

症状：

- 加载态卡住、日志中断、状态落入 error。

处理：

1. 检查 `/api/pulse/stream` 是否可达。
2. 检查 `VITE_API_BASE` 与代理配置。
3. 检查浏览器控制台 CORS/网络错误。

## 6. 发布与回归最小门禁

发布前至少执行：

1. 后端：`cd backend && ./mvnw test`
2. 前端：`cd frontend && npm test && npm run build`
3. 手工 smoke：
   - `/api/actuator/health`
   - 一次真实 query 全流程
   - 移动端报告页底部不遮挡

## 7. 容量与成本策略

1. 优先限制候选规模（`TAVILY_MAX_RESULTS`）而不是事后大量丢弃。
2. 通过 relevance gate 保留高价值样本，减少低质量 token 消耗。
3. 对高峰场景采用“先可用后完美”的降级策略，保证服务连续性。

## 8. 路线图：新闻源扩展（待实施）

当前状态：

- 方案已归档于 `Doc/history/news-source-strategy.md`（原文）。

后续建议：

1. 先做 `NewsAgent`（Search）再做 `NewsExtractAgent`（Extract）。
2. 仅白名单域名 + 限预算 + 可观测。
3. 以“可降级不阻塞主链路”为硬约束接入 orchestrator。
