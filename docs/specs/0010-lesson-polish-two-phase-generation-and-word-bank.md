# Spec: Lesson Polish, Two-Phase Generation, and Word Bank Compact Accordion

**Status**: `ready-for-agent`

## Problem Statement

When using the AI Japanese Teacher application, learners encounter several points of friction in the study loop:

1. **Slow lesson start**: Generating a lesson takes 8 to 15 seconds because vocabulary curation, 3 context examples each, and a multi-turn dialogue passage are generated in a single monolithic API call. The user is stuck staring at a button with a spinner without immediate feedback.
2. **Repetitive vocabulary**: Daily lessons frequently regenerate words that already exist in the user's permanent Word Bank, preventing the learner from building broader vocabulary.
3. **Incomplete lesson exit**: On the Daily Lesson study screens, after reviewing the target words and practicing the dialogue passage, the only way to exit is tapping the top-left back chevron. This feels like abandoning the session rather than completing it, with no sense of accomplishment or explicit completion confirmation.
4. **Indistinguishable dialogue speakers**: Speech bubbles across characters (e.g. store staff vs customer vs narrator) share identical dark background colors and fallback badge styling, making conversational turn-taking hard to follow visually.
5. **Rushed audio playback**: Continuous dialogue playback fires consecutive sentences with 0ms delay, making the dialogue feel unnatural, rushed, and difficult for non-native listeners to parse.
6. **Cluttered Word Bank**: The cumulative Word Bank displays full cards with example sentences expanded by default for every word, causing excessive vertical scrolling and visual clutter when scanning a growing dictionary.

## Solution

1. **Two-phase lesson generation with instant splash feedback**:
   - Immediately transition to a dedicated loading splash screen when the user taps "Generate Lesson".
   - Split generation into Phase 1 (Target Vocabulary + 3 Examples) and Phase 2 (Dialogue Passage).
   - Phase 1 returns quickly (~2–4s), immediately opening the Target Words study screen so learning begins without delay.
   - Phase 2 runs concurrently in the background, populating the Conversation Roleplay tab seamlessly. If the learner switches to the Conversation tab before Phase 2 finishes, display a clear loading status.
2. **Vocabulary deduplication**: Query the user's cumulative Word Bank before generation and pass learned words as negative context in the generation prompt.
3. **Lesson complete flow**: Add a prominent "Lesson Complete" action with a completion celebration banner, ensuring all lesson data is saved to history and the Word Bank before returning to the Learn home screen.
4. **Speaker visual differentiation**: Render full-width speech bubbles with distinct background tints, accent borders, and role badges for Speaker A (blue/slate), Speaker B (emerald/teal), and Narrator (purple/indigo).
5. **Paced dialogue audio playback**: Insert a natural 800ms pause (`PASSAGE_SENTENCE_GAP_MS`) between sentences during continuous dialogue playback.
6. **Compact Word Bank with on-demand accordion expansion**: Format Word Bank entries as compact single-line items showing Kanji, reading, Romaji, JLPT level badge, English definition, and quick audio button. Tapping any word expands its card to reveal the 3 contextual example sentences and encounter details.

## User Stories

1. As a Japanese learner, I want an immediate loading splash screen when I tap Generate Lesson, so that I know the app is actively building my lesson.
2. As a Japanese learner, I want vocabulary generation to complete in a few seconds, so that I can start learning target words without waiting for the full dialogue to generate.
3. As a Japanese learner, I want the conversation dialogue to generate in the background while I study the target words, so that no time is wasted waiting.
4. As a Japanese learner, I want to see a friendly loading indicator if I switch to the conversation tab before the background dialogue generation finishes, so that I understand it is still being written.
5. As a Japanese learner, I want new daily lessons to avoid words I already have in my Word Bank, so that I constantly learn new vocabulary suited to my JLPT level.
6. As a Japanese learner, I want a "Lesson Complete" button at the end of the lesson, so that I have a satisfying and clear way to finish my study session.
7. As a Japanese learner, I want a brief completion banner or animation when I finish a lesson, so that I feel rewarded for completing the session.
8. As a Japanese learner, I want all target words and lesson history to be guaranteed saved when I tap "Lesson Complete", so that my progress is never lost if I exit early.
9. As a Japanese learner, I want speech bubbles in the conversation roleplay to have distinct background colors and badge tints for different speakers, so that I can immediately tell who is speaking.
10. As a Japanese learner, I want speech bubbles to remain full width with clear furigana and English translations, so that text remains legible on mobile screens without cramped column layouts.
11. As a Japanese learner, I want an 800ms natural pause between sentences when playing the full dialogue, so that character turns sound natural and easy to follow.
12. As a Japanese learner, I want pausing or stopping the audio player to immediately cancel any pending inter-sentence delay, so that audio playback does not unexpectedly restart.
13. As a Japanese learner, I want the Word Bank to display words as compact rows, so that I can quickly scroll through and review my growing vocabulary list.
14. As a Japanese learner, I want to tap on any word in the Word Bank to expand its card, so that I can view its 3 contextual example sentences and detailed readings on demand.
15. As a Japanese learner, I want to be able to expand multiple word cards simultaneously in the Word Bank, so that I can compare examples across words side by side.
16. As a Japanese learner, I want to play audio for individual words directly from the compact Word Bank row without having to expand the card first, so that quick audio review is fast and frictionless.

## Implementation Decisions

### Generation Architecture & Interfaces
- Split lesson generation in the generation service into two distinct callable methods:
  - `generateTargetVocabulary(topic, level, apiKey?, excludeWords?)`: Generates 3–5 graded target words with definitions, romaji, and 3 contextual example sentences each.
  - `generatePassageForVocabulary(vocabulary, topic, level, apiKey?)`: Generates a graded 4–8 sentence dialogue embedding the target words, with furigana tokens and speaker IDs (`A`, `B`, `narrator`).
- Update prompt construction to accept `excludeWords: string[]`. When provided, append a negative constraint instructing the model not to pick any of the excluded words as target vocabulary.
- Maintain `generateDailyLesson` as a single-call orchestration wrapper for backward compatibility and offline fallback consistency.

### Audio Provider Architecture
- Define and export `PASSAGE_SENTENCE_GAP_MS = 800` in the audio provider module.
- In `playPassage`, schedule the transition from sentence `N` to sentence `N+1` using a non-blocking timer set to `PASSAGE_SENTENCE_GAP_MS`.
- In `stop()`, cancel both the active speech synthesis utterance and any scheduled inter-sentence timeout.

### Speaker Styling & Theme
- Update the speaker color definitions to include distinct background tints, border colors, and badge colors for:
  - `speakerA`: Subtle blue background tint (`rgba(59, 130, 246, 0.08)`), blue border, and blue badge.
  - `speakerB`: Subtle emerald background tint (`rgba(16, 185, 129, 0.08)`), emerald border, and emerald badge.
  - `narrator`: Subtle purple background tint (`rgba(168, 85, 247, 0.08)`), purple border, and purple badge.
- Map sentence `speakerId` or speaker name to the corresponding color scheme dynamically.

### Learn & Lesson Study Screen Lifecycles
- `LearnScreen`:
  - When generation is initiated, render a full-screen loading splash displaying the topic, JLPT badge, and an animated indicator.
  - Query `storageService.getWordBank()` to extract existing word surfaces and pass them into `generateTargetVocabulary`.
  - Immediately save generated vocabulary to the Word Bank upon Phase 1 resolution.
  - Navigate to `LessonStudyScreen` with `initialScreen: 'vocab'`, initiating Phase 2 in the background.
- `LessonStudyScreen`:
  - Provide a "Lesson Complete" button at the bottom of the conversation view (and secondary on vocab view).
  - Tapping "Lesson Complete" displays completion feedback, persists the lesson record via `storageService.saveLesson`, and returns the user to the Learn screen.
  - If the user switches to the Conversation tab while Phase 2 is still running, show a clean loading spinner and message. If Phase 2 errors, show an inline retry button.

### Word Bank Screen
- Render each word item as a compact card containing: Kanji, reading, Romaji, JLPT level badge, English definition, and audio play button.
- Maintain an `expandedWordIds: Set<string>` state in the component.
- Tapping a word card toggles its ID in `expandedWordIds`. When present, render the 3 example sentences (with audio playback buttons) and metadata below the main definition box.

## Testing Decisions

- **Testing philosophy**: Test external behavior through public component and service interfaces. Avoid asserting on private states or styling implementation details.
- **Seam 1 (Generation Service)**: Test `generateTargetVocabulary` and `generatePassageForVocabulary` against mock API responses, validating output structure and verifying that `excludeWords` are passed into the prompt.
- **Seam 2 (Audio Provider)**: Test `playPassage` using fake timers to verify that `PASSAGE_SENTENCE_GAP_MS` delay is observed between sentences, and that `stop()` cancels pending timers.
- **Seam 3 (Word Bank Screen)**: Test compact rendering by default, asserting that example sentences are hidden until a card press event is fired, and asserting that multiple cards can be expanded concurrently.
- **Seam 4 (Lesson Study Screen)**: Test "Lesson Complete" button triggers persistence and navigation, and verify that speech bubbles receive appropriate speaker tint styling.

## Out of Scope

- Multi-step agentic LLM pre-analysis for autonomous curriculum planning (deferred to a future roadmap milestone).
- Custom user configuration of inter-sentence delay in Settings (fixed at 800ms constant).
- Offline dictionary download packs.

## Further Notes

- All changes adhere to the domain terminology defined in `CONTEXT.md` and the architecture decisions recorded in `docs/adr/0001-two-phase-lesson-generation.md`.
