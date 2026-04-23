#!/usr/bin/env bash
# Gemini Voice Studio — macOS Build Script
# Builds the frontend and compiles the Go backend into a single binary.
# Usage: ./scripts/build-macos.sh [--arch amd64|arm64] [--clean] [--universal]
#
# With --universal, builds both amd64 and arm64 then combines via lipo.
#
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

ARCH="arm64"
CLEAN=false
UNIVERSAL=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --arch)      ARCH="$2"; shift 2 ;;
        --clean)     CLEAN=true; shift ;;
        --universal) UNIVERSAL=true; shift ;;
        *)           echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [[ "$UNIVERSAL" = false && "$ARCH" != "amd64" && "$ARCH" != "arm64" ]]; then
    echo "Error: --arch must be amd64 or arm64"
    exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$PROJECT_ROOT/bin"
EMBED_DIR="$PROJECT_ROOT/backend/internal/embed/dist"

echo "=== Gemini Voice Studio — macOS Build ==="
if [ "$UNIVERSAL" = true ]; then
    echo "Architecture: universal (amd64 + arm64)"
else
    echo "Architecture: $ARCH"
fi
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
build_binary() {
    local target_arch="$1"
    local binary_name="gemini-voice-library-darwin-$target_arch"

    echo ""
    echo "--- Compiling Go backend (darwin/$target_arch) ---"
    mkdir -p "$BIN_DIR"

    cd "$PROJECT_ROOT/backend"
    CGO_ENABLED=0 GOOS=darwin GOARCH="$target_arch" \
        go build -ldflags="-s -w" -o "$BIN_DIR/$binary_name" ./cmd/server
}

if [ "$UNIVERSAL" = true ]; then
    echo ""
    echo "--- Step 3: Building universal binary ---"
    build_binary "amd64"
    build_binary "arm64"

    UNIVERSAL_BINARY="$BIN_DIR/gemini-voice-library-darwin-universal"
    echo ""
    echo "--- Creating universal binary with lipo ---"
    lipo -create \
        "$BIN_DIR/gemini-voice-library-darwin-amd64" \
        "$BIN_DIR/gemini-voice-library-darwin-arm64" \
        -output "$UNIVERSAL_BINARY"

    SIZE=$(du -h "$UNIVERSAL_BINARY" | cut -f1)
    echo ""
    echo "=== Build complete ==="
    echo "Universal binary: $UNIVERSAL_BINARY ($SIZE)"
    echo "Run with: ./bin/gemini-voice-library-darwin-universal"
else
    echo ""
    echo "--- Step 3: Compiling Go backend ---"
    build_binary "$ARCH"

    BINARY_NAME="gemini-voice-library-darwin-$ARCH"
    SIZE=$(du -h "$BIN_DIR/$BINARY_NAME" | cut -f1)
    echo ""
    echo "=== Build complete ==="
    echo "Binary: $BIN_DIR/$BINARY_NAME ($SIZE)"
    echo "Run with: ./bin/$BINARY_NAME"
fi
