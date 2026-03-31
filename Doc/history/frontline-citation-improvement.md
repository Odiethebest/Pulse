# Frontline Citation Improvement Plan

## Background

在 `Frontline Clash / Verdict` 中，引用经常出现固定模式（例如第一句 `[1][5]`、第二句 `[2][6]`）。  
这会让引用看起来像“按位置配对”，而不是“按价值与相关性选证据”。

## Root Cause (Updated)

1. `Frontline Verdict` 实际展示的是 `quickTake[0]` 和 `quickTake[1]`，并非 `SynthesisAgent` 的 `## Frontline Clash` 文本。  
2. `quickTake` 引用来自 `PulseOrchestrator.buildQuickTake`，核心取证在 `pickEvidenceUrlsForClaim`。  
3. 当前 `pickEvidenceUrlsForClaim` 使用“等距取样 + 按 claimIndex 跳步”，会稳定产生机械配对。  
   - 当 source 数为 6 时，极易出现 `C1 -> [1][5]`、`C2 -> [2][6]`。  
4. 前端 `citationSources` 与后端 `Qn` 真实来源顺序可能不一致，造成 tooltip/来源感知错位（次要问题，不是固定配对主因）。  

结果是：即使改了 `SynthesisAgent`，`Frontline Verdict` 仍会在 `quickTake` 路径里复现 `1+5 / 2+6` 机械组合。

## Improvement Strategy (Root-cause First)

### Phase 1 — Replace QuickTake Evidence Picker (Highest Priority)

将 `pickEvidenceUrlsForClaim` 从“位置采样”改为“claim-quote 相关性打分选证据”。

建议打分维度：

- claim 文本与 quote 文本/URL 的语义相关性
- quote.evidenceWeight
- post 排序/质量分（如可用）
- 平台多样性约束（可选）

### Phase 2 — Add Mechanical Pairing Guard

在 `quickTake` 生成后增加机械配对检测：

- 若前两句出现固定偏移配对（如 `[a][a+n]`、`[b][b+n]`），自动替换第二句候选引用。
- 目标是即便排序偶然接近，也不落入固定模板。

### Phase 3 — Frontend Citation Source Alignment (Secondary but Necessary)

对 `Frontline Verdict` 的 `citationSources` 做顺序对齐：

- 按后端 `Qn` 的真实 source 顺序绑定 tooltip，不使用会重排的中间数据结构作为主来源。
- 避免“编号正确但 tooltip 映射错位”的体验问题。

### Phase 4 — Tests and Regression Gate

补齐回归测试：

- 后端：6 条 source 场景下，前两句不再稳定产出 `1+5 / 2+6`。
- 后端：固定偏移配对检测命中后会触发替换/重写。
- 前端：`[Qn]` 始终绑定第 n 条真实 source。

## Implementation Order

1. 先改 `quickTake` 取证算法（Phase 1），这是主因路径。  
2. 再加机械配对防回归（Phase 2）。  
3. 然后修前端 `Qn` 映射一致性（Phase 3）。  
4. 最后补齐自动化测试与回归门禁（Phase 4）。  

## Definition of Done

1. `Frontline Verdict` 在多次运行下不再稳定出现 `1+5 / 2+6` 固定模式。  
2. `quickTake` 引用与 claim 语义相关性显著提升。  
3. `Qn` 编号与前端 tooltip 来源一一对应。  
4. 自动化测试覆盖：取证排序、机械配对检测、前端映射一致性。  
