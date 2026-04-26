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

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
	"nhooyr.io/websocket"
	"nhooyr.io/websocket/wsjson"
)

// ProgressEvent represents a real-time progress update sent to clients.
type ProgressEvent struct {
	JobID          string `json:"job_id,omitempty"`
	Type           string `json:"type"`   // "tts", "recommend", "multi_tts", "batch_render", etc.
	Status         string `json:"status"` // "queued", "processing", "running", "complete", "error", etc.
	Message        string `json:"message,omitempty"`
	Percent        int    `json:"percent"` // 0-100
	ItemID         string `json:"item_id,omitempty"`
	ProjectID      string `json:"project_id,omitempty"`
	SegmentID      string `json:"segment_id,omitempty"`
	CompletedItems int    `json:"completed_items,omitempty"`
	TotalItems     int    `json:"total_items,omitempty"`
	FailedItems    int    `json:"failed_items,omitempty"`
	ErrorCode      string `json:"error_code,omitempty"`
}

// ProgressHub manages WebSocket connections and broadcasts progress events.
type ProgressHub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]context.CancelFunc
	Store   *store.Store
}

// NewProgressHub creates a new ProgressHub.
func NewProgressHub(st *store.Store) *ProgressHub {
	return &ProgressHub{
		clients: make(map[*websocket.Conn]context.CancelFunc),
		Store:   st,
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
	h.persistEvent(event)

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

func (h *ProgressHub) persistEvent(event ProgressEvent) {
	if h.Store == nil || event.JobID == "" || event.Type == "system" {
		return
	}
	if err := h.Store.UpsertJobProgress(store.JobProgressUpdate{
		ID:             event.JobID,
		Type:           event.Type,
		Status:         event.Status,
		Message:        event.Message,
		Percent:        event.Percent,
		ProjectID:      event.ProjectID,
		SegmentID:      event.SegmentID,
		TotalItems:     event.TotalItems,
		CompletedItems: event.CompletedItems,
		FailedItems:    event.FailedItems,
		ErrorCode:      event.ErrorCode,
	}); err != nil {
		slog.Warn("failed to persist progress event", "job_id", event.JobID, "error", err)
	}
}
