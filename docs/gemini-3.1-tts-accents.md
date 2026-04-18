# Gemini 3.1 Flash TTS: Common World Accents Input Guide

This document provides a reference list of 16 common world accents and regional variations supported by the Gemini 3.1 Flash TTS API. In Gemini 3.1, accents are primarily controlled through the `prompt` or `Director's Notes` field rather than just the `language_code`.

## How to Use
To apply an accent, include it in your **Audio Profile** or **Director's Notes** within the API request. The model interprets natural language descriptions of regionality, social class, and specific city origins.

---

| Accent Name | Language Code | Regional Specificity | Example API Prompt (Director's Notes) |
| :--- | :--- | :--- | :--- |
| **General American** | `en-US` | United States (Midwest) | "Accent: General American, neutral and professional." |
| **British (RP)** | `en-GB` | United Kingdom (Received Pronunciation) | "Accent: Formal British English (RP), sophisticated and clear." |
| **London (Brixton)** | `en-GB` | United Kingdom (South London) | "Accent: South London (Brixton), urban cadence, energetic." |
| **Australian** | `en-AU` | Australia (General) | "Accent: Australian English, friendly, soft rising intonation." |
| **Indian English** | `en-IN` | India (Urban/Neutral) | "Accent: Urban Indian English, clear articulation, slight New Delhi lilt." |
| **Canadian** | `en-CA` | Canada (Standard) | "Accent: Standard Canadian English, neutral North American with rounded vowels." |
| **Irish** | `en-IE` | Ireland (Dublin) | "Accent: Soft Dublin Irish accent, melodic and warm." |
| **Scottish** | `en-GB` | Scotland (Edinburgh) | "Accent: Scottish English, clear Edinburgh Highland influence." |
| **South African** | `en-ZA` | South Africa (Cape Town) | "Accent: South African English, crisp consonants, Cape Town style." |
| **Castilian Spanish** | `es-ES` | Spain (Madrid) | "Accent: Peninsular Spanish from Madrid, clear 'distinción' (ceceo)." |
| **Mexican Spanish** | `es-MX` | Mexico (Mexico City) | "Accent: Central Mexican Spanish, polite and rhythmic." |
| **Parisian French** | `fr-FR` | France (Paris) | "Accent: Metropolitan Parisian French, fast-paced and elegant." |
| **Quebecois French** | `fr-CA` | Canada (Quebec) | "Accent: Québécois French, distinct vowels and regional idioms." |
| **Standard German** | `de-DE` | Germany (Berlin/Standard) | "Accent: Standard German (Hochdeutsch), clear and precise." |
| **Tokyo Japanese** | `ja-JP` | Japan (Tokyo) | "Accent: Standard Japanese (Hyojungo), Tokyo-style pitch accent." |
| **Mandarin (Standard)** | `zh-CN` | China (Beijing/Standard) | "Accent: Standard Mandarin (Putonghua) with neutral Beijing influence." |

---

## Best Practices for Accent Input

1.  **Be Specific**: Gemini 3.1 understands regionality. Instead of "British," use "Manchester" or "Cockney" for better results.
2.  **Combine with Style**: Accents often sound more natural when combined with a delivery style (e.g., "Accent: Australian; Style: Laid-back and casual").
3.  **Use Audio Tags**: Enhance the accent with inline tags for a more authentic performance:
    * `[short pause]` for natural breath.
    * `[laughing]` or `[sigh]` to break up technical speech.
    * `[excitedly]` or `[whispering]` for emotional context.
4.  **Matching Voices**: Ensure the voice character (e.g., *Zephyr*, *Puck*, *Charon*) aligns with the intended accent profile.

---
*Generated for Gemini 3.1 Flash TTS API Documentation - April 2026*
