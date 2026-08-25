# Design Decision: Daily Study Workflow & History UX

**Issue**: [#5](https://github.com/CyberYeti/AI-Japanese-Teacher/issues/5)  
**Date**: 2026-08-25  

---

## 1. Summary of Decisions

### Navigation Architecture
The mobile application uses a standard 4-tab bottom navigation bar:
1. 🏠 **Learn**: Daily topic selection (rotating ideas + custom prompt input), JLPT level picker, and active study flow (Screen 1: Target Words → Screen 2: Conversation Roleplay).
2. 📖 **History**: Chronological list of past lessons with search, JLPT level filter, and Starred filter.
3. 🗂️ **Word Bank**: Cumulative master dictionary of all learned words with search, Furigana readings, and individual `🔊 Listen` audio buttons.
4. ⚙️ **Settings**: Gemini API key input with connection tester, Japanese voice selector & default speed, default JLPT level, and storage usage statistics.

### Lesson Auto-Save & FIFO Retention Policy
- **Cumulative Word Bank**: Every target vocabulary word encountered in any generated lesson is permanently added to the user's Word Bank.
- **FIFO Lesson Dialogue Queue**: Un-starred lesson dialogues auto-save up to a maximum capacity (25 lessons) on a First-In, First-Out basis to prevent local device storage bloating.
- **⭐ Starred / Pinned Lessons**: Favorited lessons bypass FIFO rotation and remain permanently stored.

### Generation & Error Recovery Flow
- One-tap generation with a themed progress indicator.
- If the Gemini API request fails, an inline error card displays the reason (e.g. invalid API key or offline) with a one-tap **🔄 Retry** button that preserves the user's topic and level input.
