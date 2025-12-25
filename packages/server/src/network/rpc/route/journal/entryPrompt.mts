import { procedure } from "../../router.mjs";

const JOURNAL_PROMPTS = [
  "What are three things you're grateful for in your sobriety journey today?",
  "Describe a moment today when you felt strong in your recovery.",
  "What coping strategies helped you navigate challenges today?",
  "How has your relationship with yourself changed since starting this journey?",
  "What is one thing you've learned about yourself this week?",
  "Write about a person who supports your sobriety and what they mean to you.",
  "What emotions came up for you today, and how did you handle them?",
  "Describe a goal you're working toward and the progress you've made.",
  "What does living authentically mean to you in recovery?",
  "Reflect on how far you've come—what would you tell your past self?",
];

export const entryPrompt = procedure.query(() => {
  const prompt =
    JOURNAL_PROMPTS[Math.floor(Math.random() * JOURNAL_PROMPTS.length)];
  return { prompt };
});
