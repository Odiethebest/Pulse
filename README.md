# Pulse Monorepo

该仓库已拆分为前后端目录：

- `backend/`：Spring Boot API（同时在打包时托管前端静态资源）
- `frontend/`：Vite + React 前端

## 本地开发

后端：

```bash
cd backend
./mvnw spring-boot:run
```

前端：

```bash
cd frontend
npm install
npm run dev
```

## 单体打包（用于单服务部署）

```bash
cd backend
./mvnw clean package
```

打包时会自动构建 `frontend` 并将 `dist` 注入后端 jar 的 `static/`。
