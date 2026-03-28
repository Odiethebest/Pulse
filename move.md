# Pulse 重构合并计划（Monorepo + Single Deploy）

> 范围声明：本计划只针对 **Pulse**。  
> `Dialectica` 是独立软件，不纳入本次改造。

## 1. 当前事实（基于现仓库）

- 后端接口：
  - `POST /pulse/analyze`
  - `GET /pulse/stream`（SSE）
  - `GET /actuator/health`
- 后端技术栈：Spring Boot + Spring AI + Reactor SSE
- 当前部署形态：后端（Railway）与前端（Vercel）分离，存在跨域与环境分歧。

## 2. 目标

1. 前后端合并到一个 GitHub 仓库管理。
2. 对外单域名、单部署入口（Railway 一个服务）。
3. 前端和 API 同域访问，默认通过 `/api`。
4. 保证 SSE（`/api/pulse/stream`）稳定，不被缓冲。
5. 本地开发与生产路径尽量一致。

## 3. 推荐方案（采用方案 A）

**方案 A：后端托管前端静态产物（单服务）**

优点：
- 部署最简单：Railway 仅一个服务。
- 同域天然避免 CORS 复杂度。
- `/api` 与静态页面同进程，排障路径最短。

取舍：
- 前后端发布节奏绑定（一次发布包含两端）。
- 构建链比纯后端多一步前端构建。

## 4. 目标目录结构

```text
/
  backend/                      # Spring Boot
  frontend/                     # Vite + React
  backend/src/main/java/...
  backend/src/main/resources/
    static/                     # 前端 dist 注入目录（构建产物）
  backend/pom.xml
  Dockerfile (可选，推荐)
```

## 5. API 路径统一策略

### 对外统一前缀（目标）

- `POST /api/pulse/analyze`
- `GET  /api/pulse/stream`
- `GET  /api/actuator/health`

### 兼容策略（过渡期）

- 保留旧路径 `/pulse/*` 一段时间（例如 1~2 个版本）。
- 前端先全部切到 `/api`，外部调用再逐步迁移。

## 6. 分提交实施计划（按顺序）

### Commit 1 - 仓库合并与前端落位

- 新增 `frontend/`，导入现有 Pulse 前端代码。
- 明确前端环境变量：
  - `VITE_API_BASE=/api`（默认值）

关键文件（前端）：
- `frontend/src/lib/api.js`（统一 API 基址）
- `frontend/vite.config.js`（本地代理 `/api -> http://localhost:8080`）
- `frontend/.env.example`

### Commit 2 - 后端 API 统一到 `/api`

- 调整 Pulse 控制器前缀到 `/api/pulse`（可加兼容映射保留旧路径）。
- 确认 SSE 端点仍返回 `text/event-stream`。

关键文件（后端）：
- `backend/src/main/java/.../controller/PulseController.java`

### Commit 3 - 同域化后 CORS 收敛

- 移除或收敛宽松 CORS 规则（同域下原则上不需要放开多个 origin）。
- 清理控制器上的 `@CrossOrigin`（若无跨域场景）。

关键文件：
- `backend/src/main/java/.../config/CorsConfig.java`
- `backend/src/main/java/.../controller/PulseController.java`

### Commit 4 - 前端静态资源托管 + SPA fallback

- 将前端构建产物复制到 `backend/src/main/resources/static/`。
- 增加 SPA fallback：
  - 非 `/api/**` 且非静态文件请求，回落 `index.html`。

关键文件：
- `backend/src/main/java/.../config/SpaFallbackFilter.java`（新增，处理 fallback）
- `backend/src/main/resources/static/**`（构建产物）

### Commit 5 - 构建链打通（推荐 Maven 一体化）

- 在 Maven 构建流程中加入：
  1. `frontend` 执行 `npm install`
  2. `frontend` 执行 `npm run build`
  3. 复制 `frontend/dist` 到 `backend/target/classes/static`
- 可选：使用 Docker 多阶段构建替代 Maven 内置 Node 构建。

关键文件：
- `backend/pom.xml`
- `Dockerfile`（若采用多阶段）

### Commit 6 - 部署与验证

- Railway 仅部署该仓库一个服务。
- 设置环境变量：
  - `OPENAI_API_KEY`
  - `TAVILY_API_KEY`
  - `PORT`（由平台注入时可不显式设置）
- 验证页面、API、SSE 全链路。

## 7. 本地联调与生产命令

## 本地开发（推荐）

1. 启动后端（8080）  
`cd backend && ./mvnw spring-boot:run`
2. 启动前端（Vite）  
`cd frontend && npm install && npm run dev`
3. 前端请求统一走 `/api`，由 Vite proxy 转发到 `localhost:8080`

## 生产构建（单服务）

- 若 Maven 一体化：
  - `cd backend && ./mvnw clean package`
- 若 Docker 多阶段：
  - `docker build -t pulse:latest .`

## 8. 验收清单

- 首页可访问（同域）。
- `POST /api/pulse/analyze` 正常返回 `PulseReport`。
- `GET /api/pulse/stream` 可持续接收事件（非一次性返回）。
- 前端刷新任意路由不 404（fallback 生效）。
- 不依赖跨域白名单即可正常使用。

## 9. 主要风险与应对

- SSE 被中间层缓冲/超时：
  - 保持 `text/event-stream`；
  - 前端增加断线重连；
  - 平台层检查连接超时策略。
- 前端路由刷新 404：
  - 必须实现 SPA fallback。
- 构建耗时上升：
  - Node 依赖缓存；
  - 前端锁版本（`package-lock.json`）。
- 兼容期外部调用失败：
  - 先保留旧 `/pulse/*`，再逐步下线。

## 10. 回滚策略

1. 保留旧路径兼容开关（或双路由）直到新前端稳定。
2. 出现线上问题时：
   - 回滚到上一个镜像/部署版本；
   - 前端临时切回旧 API 基址（若有兜底配置）。
3. 不在同一个提交中同时删除旧路由和切换前端，避免不可逆联动故障。
