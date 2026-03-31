# Pulse 架构与底层逻辑

Last updated: 2026-03-31

## 1. 代码结构（当前）

```text
Pulse/
├─ backend/
│  └─ src/main/java/com/odieyang/pulse/
│     ├─ agent/         # Query/Fetch/Sentiment/Stance/Conflict/Aspect/FlipRisk/Synthesis/Critic
│     ├─ orchestrator/  # PulseOrchestrator（主编排）
│     ├─ model/         # PulseReport 及所有结构化输出模型
│     ├─ service/       # TavilySearchService, AgentEventPublisher
│     ├─ controller/    # PulseController, ApiHealthController
│     └─ config/        # AI/CORS/SPA fallback 配置
└─ frontend/
   └─ src/
      ├─ hooks/         # usePulse（状态机）
      ├─ lib/           # api 适配、report normalize、mapper
      ├─ components/    # 展示组件（桌面/移动分离）
      └─ App.jsx        # 页面编排与流程切换
```

## 2. 后端主链路（PulseOrchestrator）

`analyze(topic, runId, locale)` 核心流程：

1. `QueryPlannerAgent.plan` 生成平台查询与 topic summary。
2. Reddit/Twitter 并行抓取（`CompletableFuture`）。
3. 抓取结果进入 `tightenCrawledPosts` 做相关性收紧：
   - 强相关门槛：topic 命中或 anchor 命中数达标。
   - 噪音硬拒绝：营销模板/壳页/过量 hashtag。
   - 平台内按 relevance 排序并截断。
4. 情感与结构分析并行：
   - `SentimentAgent`（Reddit/Twitter）
   - `StanceAgent`
   - `ConflictAgent`
   - `AspectAgent`
   - `FlipRiskAgent`
5. `SynthesisAgent` 生成初稿，`CriticAgent` 评分与建议。
6. 低质量触发一次受控重写（rewrite guidance）。
7. 生成 `claimEvidenceMap` 与 `quickTake`，并应用机械配对防护：
   - `applyQuickTakeMechanicalPairingGuard`
8. 抓取结果合并（`projectCrawledPosts`）：
   - 全局 relevance 排序（替代旧 interleave 先来先上）
   - dedupe 后取 Top-N（默认 16）
   - 平台 cap（默认每平台最多 8，不足补齐）
9. `buildTopicBuckets` 输出主题桶与分配方式（rule / llm / rule+llm / unassigned）。
10. `buildCrawlerStats` 输出覆盖率与告警。
11. 组装 `PulseReport` 返回，并写入执行事件轨迹。

## 3. 当前关键策略（落地状态）

### 3.1 Crawler 相关性策略（已生效）

- `crawler.target-total=16`
- `crawler.relevance.min-score=4`
- `crawler.relevance.min-retain-count=2`
- `crawler.relevance.min-retain-ratio=0.15`
- `crawler.relevance.max-hashtags=2`
- `crawler.relevance.platform-cap=8`

### 3.2 引用策略（已生效）

- `Frontline Verdict` 实际来源是 `quickTake[0] / quickTake[1]`。
- 引用选择按 claim-quote 相关性 + evidenceWeight + 顺序分综合评分。
- Guard 会修正固定偏移配对（如历史 `1+5 / 2+6` 模式）。

## 4. 前端底层逻辑

### 4.1 状态机与传输

`usePulse` 管理 `idle/loading/complete/error`：

1. 提交前重置状态。
2. 先建立 SSE（`/api/pulse/stream`），再发 analyze。
3. 增量接收 `AgentEvent`，累积 `agentEvents` 与 `liveText`。
4. 分析结束后关闭 SSE，落地 `report + metrics`。

### 4.2 API 归一化

`lib/api.js` 对后端 payload 做 normalize：

- `allPosts / topicBuckets / crawlerStats` 标准化。
- `citationSources` canonical 去重。
- 兼容字段缺失的回退逻辑。

### 4.3 渲染结构

- `App.jsx`：搜索 -> 加载态 theater -> 报告面板。
- 加载态按端隔离：
  - `AgentTheaterLoadingDesktop`
  - `AgentTheaterLoadingMobile`
- 报告核心区：
  - Frontline Verdict
  - Drama/Confidence
  - Controversy Lenses
  - Synthesis + Data Integrity

## 5. API 契约（当前）

主接口：

1. `POST /api/pulse/analyze`
2. `GET /api/pulse/stream`
3. `GET /api/actuator/health`

兼容路由仍可用：`/pulse/analyze`, `/pulse/stream`

前端依赖的核心响应字段（必须保持兼容）：

- `quickTake`
- `allPosts`
- `topicBuckets`
- `crawlerStats`
- `claimEvidenceMap`
- `claimAnnotations`
- `riskFlags`
- `revisionAnchors`

## 6. 配置与耦合点

后端配置文件：`backend/src/main/resources/application.properties`

关键点：

- OpenAI：`OPENAI_API_KEY`
- Tavily：`TAVILY_API_KEY`, `TAVILY_MAX_RESULTS`
- Crawler 参数：`CRAWLER_*` 系列
- 质量阈值：`debate.confidence.threshold`, `debate.quality.*`

打包耦合：

- `backend/pom.xml` 通过 `frontend-maven-plugin` 在 `prepare-package` 阶段执行前端 `npm install + npm run build`。
- 构建后 `frontend/dist` 被复制到后端静态目录，形成单体可部署产物。
