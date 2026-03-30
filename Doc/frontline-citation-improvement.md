# Frontline Citation Improvement Plan

## Background

在 `Frontline Clash / Verdict` 中，引用经常出现固定模式（例如第一句 `[1][5]`、第二句 `[2][6]`）。  
这会让引用看起来像“按位置配对”，而不是“按价值与相关性选证据”。

## Root Cause

1. `Source [n]` 编号目前按平台顺序拼接：Reddit 在前，Twitter 在后。  
2. `SentimentAgent` 对 `representativeQuotes` 只做字段规范化，不做价值重排。  
3. `SynthesisAgent` 仅校验引用多样性，不校验“固定偏移配对”模式。  

结果是：模型在写平台对照时，容易稳定选择 `1+5 / 2+6` 这类机械组合。

## Improvement Strategy

### Phase 1 (Immediate, low risk)

改用“价值排序后再编号”的证据池，不再按平台先后编号。

建议价值分：

- query/topic 相关性分
- post 排序分（已有排序元数据可复用）
- quote.evidenceWeight

### Phase 2 (Medium risk)

按 section 构建候选引用池：

- Lead 候选 id 池
- Frontline 候选 id 池

并在提示词中要求优先从对应池内引用。

### Phase 3 (Quality guard)

在输出校验中增加“固定配对模式检测”：

- 若 Frontline 连续句重复出现同偏移配对（如 `x` 总配 `x+N`），触发重写。

## Implementation Order

1. 先落地 Phase 1，验证引用分布是否明显改善。  
2. 再加 Phase 2，提升与 query 的贴合度。  
3. 最后加 Phase 3，长期防回归。  

## Definition of Done

1. Frontline 不再长期稳定出现 `1+5 / 2+6` 固定模式。  
2. 引用分布与 topic/query 相关性显著提升。  
3. 相关测试可覆盖：排序、池约束、模式检测。  
