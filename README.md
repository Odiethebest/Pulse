# Pulse

Pulse turns large scale public discussion into a report that teams can use for clear decisions.
You provide one topic.
Pulse returns platform sentiment, confidence scoring, representative quotes, and a transparent execution trace.

## Product Value

1. Reduce research time on fast moving public conversations.
2. Compare sentiment across Reddit and X in one report.
3. Improve report quality through critic review when confidence is low.
4. Expose live agent progress through server sent events.
5. Ship frontend and backend from one repository as one service.

## Repository Structure

```text
Pulse/
├─ backend/
├─ frontend/
└─ Doc/
```

## API Surface

1. `POST /api/pulse/analyze`
2. `GET /api/pulse/stream`
3. `GET /api/actuator/health`

Compatibility routes are still available.

1. `POST /pulse/analyze`
2. `GET /pulse/stream`

## Environment Requirements

1. Java 21
2. Node.js 22.12 or newer
3. OpenAI API key
4. Tavily API key

## Local Setup

Create backend environment file from repository root.

```bash
cp backend/.env.example backend/.env
```

Add your keys to `backend/.env`.

Install frontend dependencies.

```bash
npm --prefix frontend install
```

Start backend service.

```bash
cd backend
./mvnw spring-boot:run
```

Start frontend service in another terminal.

```bash
cd frontend
npm run dev
```

## Local Endpoints

1. Frontend `http://localhost:5173`
2. Backend `http://localhost:8080`
3. Frontend uses `/api` and Vite forwards requests to backend

## Production Build

Build backend package.

```bash
cd backend
./mvnw clean package
```

Run packaged service from repository root.

```bash
java -jar backend/target/pulse-*.jar
```

The backend build process also builds frontend assets and serves them as static content.

## Smoke Checks

Health check.

```bash
curl http://localhost:8080/api/actuator/health
```

Analyze request.

```bash
curl http://localhost:8080/api/pulse/analyze \
  -H "Content-Type: application/json" \
  -d '{"topic":"OpenAI releases GPT-5"}'
```

Live stream.

```bash
curl http://localhost:8080/api/pulse/stream
```

## Documentation

1. [Frontend design](Doc/frontend-design.md)
2. [Backend design](Doc/backend-design.md)
3. [System structure and dependencies](Doc/structure.md)
