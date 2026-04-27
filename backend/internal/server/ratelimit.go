// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package server - ratelimit.go applies coarse token-bucket limits per route group.
package server

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimiterConfig holds configuration for the rate limiter middleware.
type RateLimiterConfig struct {
	// TTS endpoints: POST /api/voices/tts, /api/voices/tts/multi, /api/voices/tts/stream
	TTSRate  float64 // requests per second
	TTSBurst int     // max burst size
	// Recommend endpoint: POST /api/voices/recommend
	RecommendRate  float64
	RecommendBurst int
	// General API: everything else under /api/
	GeneralRate  float64
	GeneralBurst int
}

// DefaultRateLimiterConfig returns sensible defaults for Gemini API quotas.
func DefaultRateLimiterConfig() RateLimiterConfig {
	return RateLimiterConfig{
		TTSRate:        2, // 2 req/s
		TTSBurst:       5,
		RecommendRate:  2, // 2 req/s
		RecommendBurst: 5,
		GeneralRate:    20, // 20 req/s
		GeneralBurst:   40,
	}
}

// tokenBucket implements a simple token bucket rate limiter.
type tokenBucket struct {
	mu       sync.Mutex
	tokens   float64
	maxBurst float64
	rate     float64 // tokens per second
	lastTime time.Time
}

// newTokenBucket creates a full bucket so short startup bursts are allowed.
func newTokenBucket(rate float64, burst int) *tokenBucket {
	return &tokenBucket{
		tokens:   float64(burst),
		maxBurst: float64(burst),
		rate:     rate,
		lastTime: time.Now(),
	}
}

// allow returns true if a token is available, consuming one token.
func (tb *tokenBucket) allow() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(tb.lastTime).Seconds()
	tb.lastTime = now

	// Add tokens for elapsed time
	tb.tokens += elapsed * tb.rate
	if tb.tokens > tb.maxBurst {
		tb.tokens = tb.maxBurst
	}

	if tb.tokens < 1 {
		return false
	}
	tb.tokens--
	return true
}

// rateLimiter holds per-route-group token buckets.
type rateLimiter struct {
	tts       *tokenBucket
	recommend *tokenBucket
	general   *tokenBucket
}

// rateLimitMiddleware applies per-endpoint-group rate limiting.
func rateLimitMiddleware(cfg RateLimiterConfig) func(http.Handler) http.Handler {
	rl := &rateLimiter{
		tts:       newTokenBucket(cfg.TTSRate, cfg.TTSBurst),
		recommend: newTokenBucket(cfg.RecommendRate, cfg.RecommendBurst),
		general:   newTokenBucket(cfg.GeneralRate, cfg.GeneralBurst),
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			path := r.URL.Path

			var bucket *tokenBucket
			switch {
			case strings.HasPrefix(path, "/api/voices/tts"):
				bucket = rl.tts
			case path == "/api/voices/recommend":
				bucket = rl.recommend
			case strings.HasPrefix(path, "/api/"):
				bucket = rl.general
			default:
				// Static files — no rate limiting
				next.ServeHTTP(w, r)
				return
			}

			if !bucket.allow() {
				w.Header().Set("Content-Type", "application/json")
				w.Header().Set("Retry-After", "1")
				w.WriteHeader(http.StatusTooManyRequests)
				w.Write([]byte(`{"error":"rate limit exceeded, please try again shortly"}`))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
