// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store - favorites.go persists the user's favorite voice names.
package store

// ListFavorites returns all favorited voice names.
func (s *Store) ListFavorites() ([]string, error) {
	rows, err := s.db.Query("SELECT voice_name FROM favorites ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// AddFavorite marks a voice as favorite.
func (s *Store) AddFavorite(voiceName string) error {
	_, err := s.db.Exec(
		"INSERT OR IGNORE INTO favorites (voice_name) VALUES (?)",
		voiceName,
	)
	return err
}

// RemoveFavorite removes a voice from favorites.
func (s *Store) RemoveFavorite(voiceName string) error {
	_, err := s.db.Exec("DELETE FROM favorites WHERE voice_name = ?", voiceName)
	return err
}
