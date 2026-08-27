# Spec: Word List Import, Dual-Mode Practice Passages, and Review Vocabulary Recycling

**Status**: `ready-for-agent`

## Problem Statement

1. **Manual Vocabulary Limitation**: Learners who already study Japanese with physical textbooks, Anki decks, or JLPT word lists cannot import their existing vocabulary into the app. Manually learning words one lesson at a time is tedious and restricts the app's usefulness for non-beginners.
2. **Missing Immersion Practice Mode for Known Vocabulary**: As the learner's Word Bank grows, there is no way to practice reading and listening to authentic stories or dialogues composed *specifically* from their accumulated vocabulary. Currently, every session forces the learner to acquire new target words.
3. **Lack of Spaced Repetition in Daily Dialogues**: Daily lesson dialogue passages only focus on the newly introduced target vocabulary for that session. Previously learned words are not systematically recycled or re-exposed in context, leading to vocabulary decay over time.
4. **Furigana Over-Reliance in Reading Practice**: During immersion reading and review passages, showing Furigana on every Kanji by default encourages learners to read the Hiragana crutch rather than recalling Kanji readings.

## Solution

1. **Settings Plain-Text Word List Import with Batched LLM Enrichment**:
   - Provide an **Import Word List** action in Settings opening a modal with a multiline text area.
   - Accepts plain-text Japanese words or Kanji delimited by newlines, commas, or spaces.
   - Splits inputs into manageable chunks (6–8 words per batch) and invokes the Gemini API to parse each word into structured dictionary entries (Kanji, Furigana reading, Romaji, English definition, part of speech, and 3 audio-supported contextual example sentences).
   - Shows live progress (e.g. *"Importing 12 of 30 words..."*) and automatically persists parsed entries into the cumulative Word Bank while preventing duplicate word surfaces.
2. **Learn Hub Dual Mode ("Daily Lesson" vs. "Practice Passage")**:
   - Redesign the Learn home screen into a dual-card selection hub:
     - 🌟 **Daily Graded Lesson**: The existing lesson generation flow with topic suggestions, level selector, and two-phase target vocabulary + dialogue workflow.
     - 📖 **Word Bank Practice Passage**: Immersion reading mode that generates natural passages using existing words from the cumulative Word Bank.
3. **Dual-Mode Word Selection for Practice Passages**:
   - **Auto Mode (Least-Practiced Spaced Rotation)**: Automatically selects 6–10 candidate words from the Word Bank prioritizing lowest encounter count and oldest practice timestamp, guaranteeing balanced spaced repetition over time.
   - **Custom Mode (Manual Word Selection)**: Provides an optional expandable chip/checkbox list of Word Bank words allowing learners to pick specific words to base the story around.
   - Prioritizes natural Japanese conversation flow over rigid word-stuffing, generating an authentic 4–8 sentence dialogue or story embedding the selected words.
   - Sets **Furigana to hidden (off) by default** on practice passages to encourage active reading recall, while allowing the user to toggle Furigana to "All" or "Target" on demand.
4. **Review Vocabulary Recycling in Daily Lessons**:
   - In Phase 2 of Daily Lesson generation, sample 3–5 stale words from the Word Bank and provide them as secondary review context in the passage prompt (*"Incorporate as many of these review words as fit naturally without compromising conversational fluency"*).
   - Highlights both target words and recycled review words in passage tokenization.

## User Stories

1. As a Japanese learner, I want to paste a plain text list of Japanese words into the Settings screen, so that I can import my external study vocabulary into the app's Word Bank.
2. As a Japanese learner, I want the import process to handle raw words separated by newlines, commas, or spaces, so that I don't have to manually format my text before pasting.
3. As a Japanese learner, I want the import process to run in batches with a live progress indicator, so that I can see the app working reliably without timing out on large word lists.
4. As a Japanese learner, I want imported words to automatically receive kana readings, English meanings, parts of speech, and 3 example sentences, so that imported words have the same rich detail as daily lesson vocabulary.
5. As a Japanese learner, I want importing to skip words that already exist in my Word Bank, so that I never have duplicate entries in my dictionary.
6. As a Japanese learner, I want the Learn screen to present two clear choices ("Daily Lesson" and "Practice Passage"), so that I can easily choose whether to learn new words or practice with words I already know.
7. As a Japanese learner, I want "Practice Passage" to generate a natural Japanese dialogue using words from my Word Bank, so that I can practice reading and listening to vocabulary in authentic context.
8. As a Japanese learner, I want the practice passage generator to prioritize natural conversational fluency rather than awkwardly forcing every single word into the text.
9. As a Japanese learner, I want the practice passage generator to automatically pick words I haven't practiced recently, so that all my saved words get rotated and reviewed over time.
10. As a Japanese learner, I want the option to manually select specific words from my Word Bank for a practice passage, so that I can focus on words I find difficult.
11. As a Japanese learner, I want Furigana on practice passages to be turned off by default, so that I am encouraged to test my Kanji reading memory.
12. As a Japanese learner, I want to easily toggle Furigana back on if I get stuck on a word in a practice passage.
13. As a Japanese learner, I want daily lesson dialogues to naturally include a few review words from my Word Bank, so that I reinforce older vocabulary alongside new target words.
14. As a Japanese learner, I want practice passages to be playable with audio and saveable to my lesson history, so that I can replay and review them later.
15. As a Japanese learner, I want a helpful empty state when I tap "Practice Passage" if my Word Bank has 0 words, prompting me to complete a daily lesson or import words first.

## Implementation Decisions

### Word List Import Service & Schema
- Add `importWordList(rawText: string, level: JLPTLevel, apiKey?: string, onProgress?: (completed: number, total: number) => void)` to the generation service.
- Normalize input text into distinct word tokens (filtering out empty lines and whitespace).
- Chunk tokens into batches of 6–8 items.
- For each batch, invoke Gemini with a structured schema returning `TargetWord[]` (with readings, romaji, meanings, parts of speech, and 3 examples each).
- Provide offline mock fallback for tests and offline usage.
- In `storageService`, save imported words into the Word Bank, updating encounter counts and preventing duplicates by matching `word` surface.

### Practice Passage Generation Architecture
- Add `generatePracticePassage(options: GeneratePracticePassageOptions)` to `geminiService`:
  ```ts
  export interface GeneratePracticePassageOptions {
    words: TargetWord[];
    level: JLPTLevel;
    topic?: string;
    apiKey?: string;
    customInstruction?: string;
    fetchFn?: typeof fetch;
    model?: string;
  }
  ```
- Prompt structure instructs the model:
  - Form an authentic 4–8 sentence dialogue or story on the chosen/inferred topic.
  - Embed as many of the provided focus words as fit naturally without forcing.
  - Tokenize sentences with Furigana readings for Kanji.
  - Mark `isTarget: true` on tokens matching the focus words.

### Word Bank Spaced Rotation Algorithm
- In `storageService`, enrich Word Bank items with `lastPracticedAt?: string` and `practiceCount?: number`.
- Add `storageService.getWordsForPractice(limit: number = 8)`:
  - Sorts existing Word Bank entries by `practiceCount` ascending, then `lastPracticedAt` ascending.
  - Returns top candidate words for balanced auto-rotation.
- When a practice passage or daily lesson is completed, update `lastPracticedAt = now` and increment `practiceCount` for the words utilized.

### Learn Screen Dual-Mode Hub
- Render a top-level Mode Hub on `LearnScreen.tsx`:
  - **Daily Graded Lesson Card**: Tapping opens the standard daily topic & level selection form.
  - **Word Bank Practice Passage Card**: Displays current Word Bank word count badge. Tapping opens the Practice Passage launcher (with Auto mode and Custom Word Multi-Select drawer).
  - If Word Bank is empty (<3 words), tapping Practice Passage presents a friendly call-to-action banner suggesting Daily Lesson or Word Import.

### Review Vocabulary Recycling in Daily Lesson Generation
- In `LearnScreen.tsx` during `handleGenerateLesson`, query `storageService.getWordsForPractice(4)` to select 3–5 review candidate words.
- Pass `reviewWords` into `geminiService.generatePassageForVocabulary(...)`.
- The passage prompt receives both `targetVocabulary` (mandatory) and `reviewWords` (secondary / natural fit).
- In `LessonStudyScreen.tsx`, default `furiganaMode` for practice passages to `'hidden'` while preserving the user's toggle capability.

## Testing Decisions

- Test external behavior through public service methods and screen interactions using React Native Testing Library and Jest.
- Mock external network calls to Gemini API and audio hardware providers.
- Maintain existing 13 test suites green while adding comprehensive test coverage for:
  - Word list parsing and batching in `__tests__/geminiService.test.ts`.
  - Word import modal and batch progress in `__tests__/screens/SettingsScreen.test.tsx`.
  - Dual Mode Hub and Practice Passage generation in `__tests__/screens/LearnScreen.test.tsx`.
  - Word Bank spaced-rotation query and practice count updates in `__tests__/storageService.test.ts`.
  - Default hidden Furigana and review token rendering in `__tests__/screens/LessonStudyScreen.test.tsx`.

## Out of Scope

- Anki `.apkg` binary file decompression (plain text/CSV pasting is supported).
- Cloud user account synchronization (all data resides safely in device local storage).

## Further Notes

- Maintains complete offline mock generation support across all new methods so the application remains fully functional even without an API key or active internet connection.
