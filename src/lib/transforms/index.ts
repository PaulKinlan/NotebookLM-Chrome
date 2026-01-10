/**
 * Transform functions for generating various content types from sources
 *
 * Each transform takes source content and generates a specific output format
 * (summary, quiz, slides, etc.) using the configured AI model.
 */

// Re-export the PodcastSegment type
export type { PodcastSegment } from './podcast-script.ts';

// Text-based transforms
export { generateSummary } from './summary.ts';
export { generateKeyTakeaways } from './key-takeaways.ts';
export { generateEmailSummary } from './email-summary.ts';
export { generateReport } from './report.ts';
export { generateDataTable } from './data-table.ts';
export { generateGlossary } from './glossary.ts';
export { generateComparison } from './comparison.ts';
export { generateFAQ } from './faq.ts';
export { generateActionItems } from './action-items.ts';
export { generateExecutiveBrief } from './executive-brief.ts';
export { generateProsCons } from './pros-cons.ts';
export { generateCitationList } from './citation-list.ts';
export { generateOutline } from './outline.ts';

// Interactive HTML transforms
export { generateQuiz } from './quiz.ts';
export { generatePodcastScript } from './podcast-script.ts';
export { generateSlideDeck } from './slide-deck.ts';
export { generateMindMap } from './mind-map.ts';
export { generateFlashcards } from './flashcards.ts';
export { generateTimeline } from './timeline.ts';
export { generateStudyGuide } from './study-guide.ts';
