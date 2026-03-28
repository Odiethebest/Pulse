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

## Start the Project

Run these two commands in separate terminals after setup is complete.

Terminal A

```bash
cd backend
./mvnw spring-boot:run
```

Terminal B

```bash
cd frontend
npm run dev
```

## Local Setup

1. Prepare backend environment file.

```bash
cd backend
cp .env.example .env
cd ..
```

Run this command only the first time.
Then open `backend/.env` and add your API keys.

2. Install frontend dependencies.

```bash
cd frontend
npm install
cd ..
```

If you want to apply npm security fixes, run the command in `frontend`.

```bash
cd frontend
npm audit fix
cd ..
```

3. Start backend service in Terminal A.

```bash
cd backend
./mvnw spring-boot:run
```

Keep Terminal A running after the command starts the server.
Do not run any other command in Terminal A.

4. Start frontend service in Terminal B.

Open a new terminal window first.

```bash
cd frontend
npm run dev
```

## Local Endpoints

1. Frontend `http://localhost:5173`
2. Backend `http://localhost:8080`
3. Frontend uses `/api` and Vite forwards requests to backend

## Troubleshooting

If you see this Maven error, the command was typed incorrectly.

`Could not find goal 'runcd'`

Use the exact command below.

```bash
cd backend
./mvnw spring-boot:run
```

## Production Build

1. Build backend package.

```bash
cd backend
./mvnw clean package
cd ..
```

2. Run packaged service.

```bash
cd backend/target
java -jar pulse-*.jar
```

The backend build process also builds frontend assets and serves them as static content.

## Smoke Checks

1. Health check.

```bash
curl -sS http://localhost:8080/api/actuator/health
```

2. Analyze request.

```bash
curl -sS -X POST http://localhost:8080/api/pulse/analyze -H "Content-Type: application/json" -d '{"topic":"OpenAI releases GPT-5"}'
```

3. Live stream.

```bash
curl -N http://localhost:8080/api/pulse/stream
```

## Documentation

1. [Frontend design](Doc/frontend-design.md)
2. [Backend design](Doc/backend-design.md)
3. [System structure and dependencies](Doc/structure.md)
