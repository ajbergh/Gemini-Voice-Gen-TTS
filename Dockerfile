# Multi-stage Dockerfile for Gemini Voice Studio
# Stage 1: Build frontend
# Stage 2: Build Go binary with embedded frontend
# Stage 3: Minimal runtime image

# --- Stage 1: Frontend Build ---
FROM node:22-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY index.html index.tsx index.css App.tsx api.ts constants.ts types.ts declarations.d.ts tsconfig.json vite.config.ts ./
COPY components/ components/
RUN npm run build

# --- Stage 2: Go Build ---
FROM golang:1.24-alpine AS backend
RUN apk add --no-cache git
WORKDIR /app/backend

# Cache Go modules
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source
COPY backend/ .

# Copy frontend build into the embed directory
COPY --from=frontend /app/dist ./internal/embed/dist/

# Build static binary (CGO_ENABLED=0 for modernc.org/sqlite)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# --- Stage 3: Runtime ---
FROM alpine:3.21
RUN apk add --no-cache ca-certificates tzdata && \
    adduser -D -h /home/app app
USER app
WORKDIR /home/app

COPY --from=backend /server /usr/local/bin/server

# Default data directory
RUN mkdir -p /home/app/data

EXPOSE 8080

ENTRYPOINT ["server"]
CMD ["--port", "8080", "--db", "/home/app/data/gemini-voice.db", "--open=false"]
