// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package crypto provides AES-256-GCM encryption and decryption for API keys.
//
// Keys are derived from a user-supplied passphrase or, when none is given,
// from a machine-specific identifier (hostname + username). Encryption uses
// a random 12-byte nonce per operation and authenticates data with GCM.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"os/user"
)

// DeriveKey derives a 32-byte AES-256 key from a passphrase and a salt.
// If passphrase is empty, a machine-derived fallback is used.
func DeriveKey(passphrase string) ([]byte, error) {
	if passphrase == "" {
		var err error
		passphrase, err = machineID()
		if err != nil {
			return nil, fmt.Errorf("derive machine id: %w", err)
		}
	}
	h := sha256.Sum256([]byte(passphrase))
	return h[:], nil
}

// Encrypt encrypts plaintext using AES-256-GCM. Returns ciphertext and nonce.
func Encrypt(key, plaintext []byte) (ciphertext, nonce []byte, err error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("new gcm: %w", err)
	}

	nonce = make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, fmt.Errorf("generate nonce: %w", err)
	}

	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)
	return ciphertext, nonce, nil
}

// Decrypt decrypts ciphertext using AES-256-GCM with the given nonce.
func Decrypt(key, ciphertext, nonce []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("new cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("new gcm: %w", err)
	}

	if len(nonce) != gcm.NonceSize() {
		return nil, errors.New("invalid nonce size")
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("decrypt: %w", err)
	}

	return plaintext, nil
}

// machineID returns a deterministic string derived from the machine's hostname and current user.
func machineID() (string, error) {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "unknown-host"
	}
	u, err := user.Current()
	if err != nil {
		return "", fmt.Errorf("get current user: %w", err)
	}
	return fmt.Sprintf("gemini-voice-library:%s:%s", hostname, u.Username), nil
}
