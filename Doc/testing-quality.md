# Pulse 测试与质量规范

Last updated: 2026-03-31

## 1. 测试目标

Pulse 测试的核心目标：

1. 保证端到端主链路可运行（查询 -> 抓取 -> 分析 -> 报告）。
2. 保证高风险策略不回退（crawler relevance、citation、mobile UI）。
3. 保证前后端契约稳定（`allPosts/topicBuckets/crawlerStats` 可解析）。

## 2. 当前自动化测试版图

## 2.1 Backend（JUnit / Maven）

主要测试文件：

1. `PulseOrchestratorV2Tests`
2. `PulseControllerV2Tests`
3. `PulseReportSerializationTests`
4. `TwitterAgentTests`
5. `SynthesisAgentFormattingTests`
6. `AgentEventPublisherTests`
7. `PublicOpinionAnalysisSystemApplicationTests`

重点覆盖：

- 编排并行与降级
- crawler 收紧与全局合并策略
- quickTake/citation 防机械配对
- 报告结构字段与 JSON 兼容

## 2.2 Frontend（Vitest）

主要测试模块：

1. `components/__tests__/*`
2. `hooks/__tests__/usePulseV2.test.js`
3. `lib/__tests__/*`

重点覆盖：

- 组件渲染与交互
- `usePulse` 生命周期
- API normalize 与 citation source 对齐
- controversy 数据映射
- 移动端 theater 行为与隔离

## 3. 强制门禁（提交前）

每次功能改动至少执行：

1. `cd backend && ./mvnw test`
2. `cd frontend && npm test`
3. `cd frontend && npm run build`

如变更涉及 crawler/citation/mobile，必须补充对应定向测试并通过。

## 4. 回归高风险清单

## 4.1 Crawler 相关

1. `allPosts.size() <= 16`
2. `crawlerStats.targetTotal == 16`
3. 噪音帖子不过滤回归（营销/壳页/泛娱乐）
4. 合并策略保持“全局相关优先”，非先来先上

## 4.2 引用相关

1. Frontline 不回退到固定偏移引用模式
2. claim 引用与 query 语义相关
3. citation source 映射顺序稳定

## 4.3 UI 相关

1. 移动端底部动作条不遮挡 `Data Integrity`
2. 移动端/桌面端布局隔离不互相污染
3. 关键面板在窄屏不截断核心信息

## 5. 手工验证模板（发布前）

建议最少 3 组真实 query：

1. 高相关热门话题
2. 低相关长尾话题
3. 噪音容易混入的话题

每组检查：

1. Frontline 是否能给出可追踪引用。
2. Controversy 主题是否与 query 核心语义一致。
3. Data Integrity 是否可见并有合理告警。
4. 移动端报告末尾是否可完整滚动查看。

## 6. 新增测试约定

1. 改策略必须配对应断言，不接受只改实现不补测试。
2. 测试命名表达“业务意图”，避免泛化命名。
3. 优先在现有测试文件扩展，只有在职责明显新增时再建新文件。
4. 回归 bug 需要“先复现测试，再修复实现”。
