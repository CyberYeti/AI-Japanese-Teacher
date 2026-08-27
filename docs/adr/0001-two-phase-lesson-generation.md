# Two-Phase Lesson Generation and Vocabulary Deduplication

## Context
Full lesson generation (curated vocabulary with 3 examples each plus a multi-turn graded dialogue passage) took 8 to 15 seconds in a single LLM prompt, causing noticeable wait times before learners could start studying. Additionally, learners repeatedly encountered words already in their cumulative Word Bank.

## Decision
1. Split lesson generation into two asynchronous phases:
   - **Phase 1 (Target Vocabulary + Examples)**: Fast focused prompt (~2–4s). Immediately transitions learner to the Target Words screen and persists new words to the Word Bank.
   - **Phase 2 (Dialogue Passage)**: Triggered concurrently in the background using the newly generated vocabulary. Seamlessly populates the Conversation Roleplay tab upon arrival.
2. Prevent vocabulary repetition by querying the user's cumulative Word Bank and passing recent learned words as an exclusion list directly in the Phase 1 generation prompt.

## Considered Options
- **Single monolithic prompt**: Simpler implementation, but learner remains blocked on a loading screen for the full passage duration.
- **Agentic curriculum pre-pass ("analyze learned words and suggest next topic")**: High cognitive value for future personalized roadmaps, but adds an extra blocking LLM roundtrip and doubles latency during lesson creation. Deferred to a future milestone.
