.PHONY: frontend backend build build-all clean dev run

# Build frontend
frontend:
	cd ../frontend && npm ci && npm run build
	@if exist ..\backend\internal\embed\dist rmdir /s /q ..\backend\internal\embed\dist 2>nul
	xcopy /E /I /Y ..\frontend\dist ..\backend\internal\embed\dist

# Build backend (requires frontend to be built first)
backend: frontend
	set CGO_ENABLED=0&& go build -ldflags="-s -w" -o ../bin/gemini-voice-library.exe ./cmd/server

# Default build
build: backend

# Cross-compile for all platforms
build-all: frontend
	set CGO_ENABLED=0&& set GOOS=windows&& set GOARCH=amd64&& go build -ldflags="-s -w" -o ../bin/gemini-voice-library-windows-amd64.exe ./cmd/server
	set CGO_ENABLED=0&& set GOOS=darwin&& set GOARCH=amd64&& go build -ldflags="-s -w" -o ../bin/gemini-voice-library-darwin-amd64 ./cmd/server
	set CGO_ENABLED=0&& set GOOS=darwin&& set GOARCH=arm64&& go build -ldflags="-s -w" -o ../bin/gemini-voice-library-darwin-arm64 ./cmd/server
	set CGO_ENABLED=0&& set GOOS=linux&& set GOARCH=amd64&& go build -ldflags="-s -w" -o ../bin/gemini-voice-library-linux-amd64 ./cmd/server
	set CGO_ENABLED=0&& set GOOS=linux&& set GOARCH=arm64&& go build -ldflags="-s -w" -o ../bin/gemini-voice-library-linux-arm64 ./cmd/server

# Development mode: run backend with frontend proxy
dev:
	go run ./cmd/server --port 8080 --log-level debug --open=false

# Run production binary
run:
	../bin/gemini-voice-library.exe

# Clean build artifacts
clean:
	if exist ../bin rmdir /s /q ../bin
	if exist ../frontend/dist rmdir /s /q ../frontend/dist
