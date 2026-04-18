// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// ProgressEvent represents a real-time progress update sent to clients.
type ProgressEvent struct {
	JobID   string `json:"job_id"`
	Type    string `json:"type"`   // "tts", "recommend", "multi_tts"
	Status  string `json:"status"` // "queued", "processing", "complete", "error"
	Message string `json:"message,omitempty"`
	Percent int    `json:"percent"` // 0-100
}

// ProgressHub manages WebSocket connections and broadcasts progress events.
type ProgressHub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]context.CancelFunc
}

// NewProgressHub creates a new ProgressHub.
func NewProgressHub() *ProgressHub {
	return &ProgressHub{
		clients: make(map[*websocket.Conn]context.CancelFunc),
	}
}

// HandleWS handles WebSocket upgrade and registration.
func (h *ProgressHub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"localhost", "127.0.0.1", "::1", "[::1]"},
	})
	if err != nil {
		slog.Warn("websocket accept failed", "error", err)
		return
	}

	ctx, cancel := context.WithCancel(r.Context())

	h.mu.Lock()
	h.clients[conn] = cancel
	h.mu.Unlock()

	slog.Debug("websocket client connected", "clients", len(h.clients))

	// Send a welcome message
	wsjson.Write(ctx, conn, ProgressEvent{
		Type:    "system",
		Status:  "connected",
		Message: "Progress updates active",
	})

	// Keep connection alive by reading (and discarding) messages from client
	for {
		_, _, err := conn.Read(ctx)
		if err != nil {
			break
		}
	}

	h.mu.Lock()
	delete(h.clients, conn)
	h.mu.Unlock()
	cancel()
	conn.Close(websocket.StatusNormalClosure, "")
	slog.Debug("websocket client disconnected", "clients", len(h.clients))
}

// Broadcast sends a progress event to all connected WebSocket clients.
func (h *ProgressHub) Broadcast(event ProgressEvent) {
	h.mu.RLock()
	clients := make(map[*websocket.Conn]context.CancelFunc, len(h.clients))
	for c, cancel := range h.clients {
		clients[c] = cancel
	}
	h.mu.RUnlock()

	if len(clients) == 0 {
		return
	}

	data, err := json.Marshal(event)
	if err != nil {
		return
	}

	var disconnected []*websocket.Conn
	for conn := range clients {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		err := conn.Write(ctx, websocket.MessageText, data)
		cancel()
		if err != nil {
			disconnected = append(disconnected, conn)
		}
	}

	// Clean up disconnected clients
	if len(disconnected) > 0 {
		h.mu.Lock()
		for _, conn := range disconnected {
			if cancel, ok := h.clients[conn]; ok {
				cancel()
				delete(h.clients, conn)
				conn.Close(websocket.StatusGoingAway, "")
			}
		}
		h.mu.Unlock()
	}
}

// EmitProgress is a convenience method for emitting a progress event with job details.
func (h *ProgressHub) EmitProgress(jobID, jobType, status, message string, percent int) {
	h.Broadcast(ProgressEvent{
		JobID:   jobID,
		Type:    jobType,
		Status:  status,
		Message: message,
		Percent: percent,
	})
}
