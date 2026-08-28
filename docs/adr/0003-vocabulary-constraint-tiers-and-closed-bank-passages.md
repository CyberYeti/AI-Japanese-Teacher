# Vocabulary Constraint Tiers, Closed Word Bank Prompts, and Comprehensible Input (i+1)

## Context
Beginner Japanese learners with small active vocabularies (~70 words) experience high cognitive friction when reading AI-generated passages that introduce unconstrained vocabulary. While standard JLPT N5 prompts attempt level-appropriate Japanese, LLMs frequently draw upon the wider 800+ word N5 dictionary, resulting in passages with numerous unfamiliar words that obscure sentence comprehension and hinder recall of newly studied target words.

At the same time, permanently restricting passages to a closed vocabulary would limit vocabulary growth once the learner grasps basic sentence grammar. Learners need a seamless transition between pure recall drilling and guided vocabulary expansion.

## Decision
1. **Three-Tier Vocabulary Constraint System**:
   - **Strict Closed Bank (`strict`)**: 100% of content words (nouns, verbs, adjectives, adverbs) must originate strictly from the user's Word Bank (plus the session's Target Vocabulary for Daily Lessons). Content vocabulary is bound together with standard level-appropriate particles (は, が, を, に, で, と) and basic inflections/copulas. Zero unlearned content words.
   - **Comprehensible Input / i+1 (`i_plus_one`)**: 85–90% Word Bank vocabulary, intentionally introducing 1–2 level-appropriate novel words in context with explicit glossing.
   - **Natural Graded Immersion (`natural`)**: Free-form level-appropriate dialogue embedding target words without strict Word Bank confinement (legacy behavior).

2. **Full Known Inventory Prompt Injection**:
   - When generating Daily Lesson dialogues (Phase 2) or Practice Passages under `strict` or `i_plus_one` tiers, the user's cumulative Word Bank is injected into the Gemini prompt under a `KNOWN VOCABULARY INVENTORY` block.
   - For sparse Word Banks (< 15 words), prompts provide an explicit fallback whitelist of universal beginner survival words (`はい`, `いいえ`, `ありがとう`, `これ`, `それ`, `行く`, `食べる`, `好き`, etc.) to preserve conversational coherence.

3. **Novel Word Extraction and 1-Tap Acquisition (`i+1` Mode)**:
   - Passage response schemas include `novelWords?: TargetWord[]` and `isNovel?: boolean` token flags.
   - The passage reader renders a 3-tier color hierarchy:
     - 🟡 **Gold / Amber**: Target Vocabulary (`isTarget: true`)
     - 🟢 **Teal / Green**: Novel i+1 Vocabulary (`isNovel: true`)
     - ⚪ **Standard Text**: Known Word Bank words & grammatical particles
   - An expandable "✨ New Words in this Passage" card below the dialogue displays readings and definitions, with a 1-tap button to save novel words directly into the user's Word Bank.

4. **UI Surfaces & Defaults**:
   - Persisted in `UserSettings.vocabularyConstraint`, defaulting to `'strict'` for new learners.
   - An interactive 3-way segmented pill selector is rendered on the **Learn Screen** for on-the-fly toggling per study session.
