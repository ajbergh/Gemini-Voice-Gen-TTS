#!/usr/bin/env bash
# Gemini Voice Library — Linux Build Script
# Builds the frontend and compiles the Go backend into a single binary.
# Usage: ./scripts/build-linux.sh [--arch amd64|arm64] [--clean]
#
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

ARCH="amd64"
CLEAN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --arch)  ARCH="$2"; shift 2 ;;
        --clean) CLEAN=true; shift ;;
        *)       echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ "$ARCH" != "amd64" && "$ARCH" != "arm64" ]]; then
    echo "Error: --arch must be amd64 or arm64"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$PROJECT_ROOT/bin"
EMBED_DIR="$PROJECT_ROOT/backend/internal/embed/dist"
BINARY_NAME="gemini-voice-library-linux-$ARCH"

echo "=== Gemini Voice Library — Linux Build ==="
echo "Architecture: $ARCH"
echo "Project root: $PROJECT_ROOT"

# Clean previous artifacts if requested
if [ "$CLEAN" = true ]; then
    echo ""
    echo "--- Cleaning previous build artifacts ---"
    rm -rf "$BIN_DIR" "$EMBED_DIR" "$PROJECT_ROOT/dist"
fi

# Step 1: Build frontend
echo ""
echo "--- Step 1: Building frontend ---"
cd "$PROJECT_ROOT"
npm install --silent
npx vite build

# Step 2: Copy frontend dist to embed directory
echo ""
echo "--- Step 2: Copying frontend to embed directory ---"
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo "Error: Frontend build output not found at $PROJECT_ROOT/dist"
    exit 1
fi
rm -rf "$EMBED_DIR"
cp -r "$PROJECT_ROOT/dist" "$EMBED_DIR"

# Step 3: Build Go binary
echo ""
echo "--- Step 3: Compiling Go backend (linux/$ARCH) ---"
mkdir -p "$BIN_DIR"

cd "$PROJECT_ROOT/backend"
CGO_ENABLED=0 GOOS=linux GOARCH="$ARCH" \
    go build -ldflags="-s -w" -o "$BIN_DIR/$BINARY_NAME" ./cmd/server

SIZE=$(du -h "$BIN_DIR/$BINARY_NAME" | cut -f1)

echo ""
echo "=== Build complete ==="
echo "Binary: $BIN_DIR/$BINARY_NAME ($SIZE)"
echo "Run with: ./bin/$BINARY_NAME"
