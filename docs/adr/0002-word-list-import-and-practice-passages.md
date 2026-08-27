# Word List Import, Dual-Mode Practice Passages, and Review Recycling

## Context
Learners have existing Japanese vocabulary lists from external study resources (Anki, Genki, JLPT decks, textbooks) and need a frictionless way to import them into their Word Bank without manual entry. Additionally, as the Word Bank grows, learners need immersion reading practice that exercises their existing vocabulary in authentic passages without requiring new word acquisition. Finally, daily lesson dialogues need to recycle older words to reinforce long-term spaced retention.

## Decision
1. **Batched Plain-Text Import with LLM Enrichment**:
   - Provide an import modal in Settings that accepts plain text (newline/comma/space-separated words or Kanji).
   - Process words in asynchronous batches of 6–8 words via Gemini to enrich each word with kana readings, romaji, part of speech, English definition, and 3 audio-supported context sentences.
   - Display a live batch progress bar and automatically save enriched items to the cumulative Word Bank.

2. **Learn Hub Dual Modes: Daily Lesson & Practice Passage**:
   - Structure the Learn landing screen into two primary mode cards: **Daily Graded Lesson** and **Word Bank Practice Passage**.
   - Practice Passage mode generates authentic dialogues/passages using existing vocabulary from the Word Bank, supporting:
     - **Auto Mode (Spaced Rotation)**: Selects 6–10 least-recently practiced words to guarantee even vocabulary rotation over time.
     - **Custom Mode**: Lets the user select specific words from their Word Bank to generate custom targeted stories.
   - Sets **Furigana to hidden (off) by default** for practice passages to stimulate active reading recall.

3. **Soft Review Word Recycling in Daily Lessons**:
   - Phase 2 dialogue generation passes 3–5 stale words from the Word Bank as secondary review context alongside fresh target vocabulary.
   - The model is instructed to weave in review words naturally without forcing or compromising conversational fluency.

## Considered Options
- **Strict Review Quota**: Forcing a rigid number of review words in every daily passage risked unnatural sentence phrasing and degraded dialogue authenticity.
- **Single Bulk Import Prompt**: Attempting to parse 50+ words in a single LLM request risked token truncation, formatting errors, and timeouts. Batched processing provides predictable reliability and progress feedback.
