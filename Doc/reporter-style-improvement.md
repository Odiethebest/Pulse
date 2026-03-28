# Pulse V2 报道风格与反空话改造方案

## 1. 问题定义

当前报告的核心问题不是模型能力不足，而是写作任务定义过宽，导致输出出现以下现象：

1. 文案重复，结论密度低，读者读完不知道重点。
2. 有观点但证据绑定弱，容易被感知为套话。
3. 风格不像一线报道，更像泛化总结。

## 2. 本轮结论

### 2.1 评论家文本可以明显改进

可以。改进方向是从“自由生成”切换为“硬结构写作”：

1. 每条核心结论必须绑定至少一条引用证据。
2. 无证据的句子不得进入摘要区。
3. 引入反空话评分，命中泛化句式时触发重写。

### 2.2 最终行文可以采用记者报道体

可以。建议是“记者体表达 + 证据链约束”，避免文学化夸张和主观煽动。

### 2.3 参考原则可落地到现有 Pulse

可以直接映射到当前链路：

1. Hook：用导语替换第一句 quick take。
2. 故事化：围绕阵营冲突写人物化对线段落。
3. 增量信息：增加平台差异和反转观察。
4. 切身相关：固定输出一段 why it matters。

## 3. 报道模板规范

每次输出固定为六段，按顺序展示：

1. **Lead**  
前 50 字，直接给冲突和当前进展。

2. **Frontline Clash**  
支持方和反对方各 1 到 2 条代表表达，必须带出处。

3. **Top Controversies**  
热度最高的 3 个争议维度，说明为什么吵。

4. **Flip Risk Watch**  
指出最可能反转的叙事，并写清触发条件。

5. **Why It Matters**  
说明对普通用户的现实影响。

6. **Reporter Note**  
交代样本范围、时间窗口、证据盲区。

## 4. 反空话与证据约束

新增内容质量闸门：

1. 结论必须有证据映射，格式为 `claimId -> quote/url`。
2. 检测泛化句式，如“总体来看”“多方观点”“引发热议”等空泛组合，超过阈值重写。
3. 关键信息密度检查，单段至少包含一个具体对象、行为或数字。

## 5. 后端改造建议

### 5.1 `SynthesisAgent`

文件：`backend/src/main/java/com/odieyang/pulse/agent/SynthesisAgent.java`

1. 改写 prompt，强制六段模板输出。
2. 要求每条核心结论绑定证据索引。
3. 输出结构可扩展为段落化字段，减少前端二次解析。

### 5.2 `CriticAgent`

文件：`backend/src/main/java/com/odieyang/pulse/agent/CriticAgent.java`

1. 新增反空话审计项，例如 `fluffFindings`、`informationDensityScore`。
2. 新增 `claimEvidenceCoverage`，校验结论证据覆盖率。
3. 低覆盖或高空话时，返回强制重写建议。

### 5.3 `PulseOrchestrator`

文件：`backend/src/main/java/com/odieyang/pulse/orchestrator/PulseOrchestrator.java`

1. 在组装报告前增加质量闸门判断。
2. 对不达标结果触发一次定向重写。
3. 仍保留失败降级，避免最后一步失败导致整单报错。

## 6. 前端改造建议

### 6.1 `SynthesisReport`

文件：`frontend/src/components/SynthesisReport.jsx`

1. 按六段模板渲染，不再直接堆叠长文。
2. 每条核心结论旁显示证据锚点，可跳转到引用卡片。

### 6.2 `QuoteCards`

文件：`frontend/src/components/QuoteCards.jsx`

1. 增加 `claimId` 高亮联动，支持“结论追证据”。
2. 对未被引用的卡片降权展示。

## 7. 验收标准

以下条件全部满足才算完成该轮改造：

1. 用户在 10 秒内能说出事件主冲突和双方立场。
2. 每条核心结论都能在 UI 上直接跳到对应证据。
3. 文案重复率显著下降，空话段落被质量闸门拦截。
4. 报告风格接近记者快报，且保留证据可追溯性。

## 8. 实施优先级

1. 第一优先级：`SynthesisAgent` 模板化和证据绑定。
2. 第二优先级：`CriticAgent` 反空话审计。
3. 第三优先级：前端结论与证据联动渲染。
