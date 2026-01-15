// ============================================================================
// Transformations
// ============================================================================

import type { SyncableEntity } from './sync.ts'

export type TransformationType
  = | 'podcast'
    | 'quiz'
    | 'takeaways'
    | 'email'
    | 'slidedeck'
    | 'report'
    | 'datatable'
    | 'mindmap'
    | 'flashcards'
    | 'timeline'
    | 'glossary'
    | 'comparison'
    | 'faq'
    | 'actionitems'
    | 'executivebrief'
    | 'studyguide'
    | 'proscons'
    | 'citations'
    | 'outline'

export interface Transformation extends SyncableEntity {
  notebookId: string
  type: TransformationType
  title: string
  content: string
  sourceIds: string[]
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
}

export interface Quiz {
  questions: QuizQuestion[]
}

// ============================================================================
// Transformation Configuration
// ============================================================================

/**
 * Common fields shared by all transformation configs
 */
export interface BaseTransformConfig {
  /** Custom instructions to append to the prompt */
  customInstructions?: string
}

/**
 * Podcast Script configuration
 */
export interface PodcastConfig extends BaseTransformConfig {
  /** Approximate duration in minutes */
  lengthMinutes: number
  /** Tone of the conversation */
  tone: 'casual' | 'professional' | 'educational' | 'entertaining'
  /** Number of speakers/hosts */
  speakerCount: 2 | 3
  /** Names for the speakers (optional) */
  speakerNames?: string[]
  /** Focus area or topic angle */
  focusArea?: string
}

/**
 * Quiz configuration
 */
export interface QuizConfig extends BaseTransformConfig {
  /** Number of questions to generate */
  questionCount: number
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  /** Types of questions to include */
  questionTypes: ('multiple-choice' | 'true-false')[]
  /** Whether to include explanations */
  includeExplanations: boolean
}

/**
 * Key Takeaways configuration
 */
export interface TakeawaysConfig extends BaseTransformConfig {
  /** Number of key points to extract */
  pointCount: number
  /** Format style */
  format: 'bullets' | 'numbered' | 'paragraphs'
  /** Include supporting details */
  includeDetails: boolean
}

/**
 * Email Summary configuration
 */
export interface EmailConfig extends BaseTransformConfig {
  /** Tone of the email */
  tone: 'formal' | 'casual' | 'professional'
  /** Target length */
  length: 'brief' | 'standard' | 'detailed'
  /** Include call to action */
  includeCallToAction: boolean
  /** Recipient context (e.g., "for my team", "for executives") */
  recipientContext?: string
}

/**
 * Slide Deck configuration
 */
export interface SlideDeckConfig extends BaseTransformConfig {
  /** Number of slides to generate */
  slideCount: number
  /** Style of the presentation */
  style: 'minimal' | 'detailed' | 'visual'
  /** Include speaker notes */
  includeSpeakerNotes: boolean
}

/**
 * Report configuration
 */
export interface ReportConfig extends BaseTransformConfig {
  /** Report format/style */
  format: 'academic' | 'business' | 'technical' | 'executive'
  /** Sections to include */
  sections: ('executive-summary' | 'introduction' | 'findings' | 'analysis' | 'conclusions' | 'recommendations')[]
  /** Target length */
  length: 'brief' | 'standard' | 'comprehensive'
}

/**
 * Data Table configuration
 */
export interface DataTableConfig extends BaseTransformConfig {
  /** Maximum number of columns */
  maxColumns: number
  /** Maximum number of rows */
  maxRows: number
  /** Include summary row */
  includeSummary: boolean
}

/**
 * Mind Map configuration
 */
export interface MindMapConfig extends BaseTransformConfig {
  /** Maximum depth of branches */
  maxDepth: number
  /** Maximum nodes per branch */
  maxNodesPerBranch: number
  /** Layout style */
  layout: 'radial' | 'tree' | 'organic'
}

/**
 * Flashcards configuration
 */
export interface FlashcardsConfig extends BaseTransformConfig {
  /** Number of flashcards to generate */
  cardCount: number
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed'
  /** Card style */
  cardStyle: 'question-answer' | 'term-definition' | 'concept-example'
  /** Include hints */
  includeHints: boolean
}

/**
 * Timeline configuration
 */
export interface TimelineConfig extends BaseTransformConfig {
  /** Layout orientation */
  layout: 'vertical' | 'horizontal'
  /** Maximum number of events */
  maxEvents: number
  /** Include descriptions */
  includeDescriptions: boolean
  /** Group by category */
  groupByCategory: boolean
}

/**
 * Glossary configuration
 */
export interface GlossaryConfig extends BaseTransformConfig {
  /** Definition length */
  definitionLength: 'concise' | 'standard' | 'detailed'
  /** Include examples */
  includeExamples: boolean
  /** Include related terms */
  includeRelatedTerms: boolean
  /** Sort order */
  sortOrder: 'alphabetical' | 'by-importance' | 'by-category'
}

/**
 * Comparison configuration
 */
export interface ComparisonConfig extends BaseTransformConfig {
  /** Maximum items to compare */
  maxItems: number
  /** Comparison format */
  format: 'table' | 'side-by-side' | 'prose'
  /** Include overall recommendation */
  includeRecommendation: boolean
}

/**
 * FAQ configuration
 */
export interface FAQConfig extends BaseTransformConfig {
  /** Number of questions to generate */
  questionCount: number
  /** Answer length */
  answerLength: 'brief' | 'standard' | 'detailed'
  /** Question style */
  questionStyle: 'formal' | 'conversational'
  /** Group by topic */
  groupByTopic: boolean
}

/**
 * Action Items configuration
 */
export interface ActionItemsConfig extends BaseTransformConfig {
  /** Include priority levels */
  includePriority: boolean
  /** Priority format */
  priorityFormat: 'high-medium-low' | 'p1-p2-p3' | 'urgent-normal-low'
  /** Include deadlines/timeframes */
  includeTimeframes: boolean
  /** Group by category */
  groupByCategory: boolean
}

/**
 * Executive Brief configuration
 */
export interface ExecutiveBriefConfig extends BaseTransformConfig {
  /** Target length */
  length: 'one-page' | 'half-page' | 'two-pages'
  /** Sections to include */
  sections: ('overview' | 'key-findings' | 'implications' | 'recommendations' | 'next-steps')[]
  /** Focus area */
  focusArea?: string
}

/**
 * Study Guide configuration
 */
export interface StudyGuideConfig extends BaseTransformConfig {
  /** Depth of coverage */
  depth: 'overview' | 'standard' | 'comprehensive'
  /** Sections to include */
  sections: ('summary' | 'key-concepts' | 'examples' | 'practice-questions' | 'resources')[]
  /** Target audience level */
  audienceLevel: 'beginner' | 'intermediate' | 'advanced'
}

/**
 * Pros & Cons configuration
 */
export interface ProsConsConfig extends BaseTransformConfig {
  /** Format style */
  format: 'table' | 'lists' | 'detailed'
  /** Include neutral points */
  includeNeutral: boolean
  /** Include overall assessment */
  includeAssessment: boolean
  /** Weigh importance */
  weighImportance: boolean
}

/**
 * Citation List configuration
 */
export interface CitationsConfig extends BaseTransformConfig {
  /** Citation styles to generate */
  styles: ('apa' | 'mla' | 'chicago' | 'harvard' | 'ieee')[]
  /** Include annotations */
  includeAnnotations: boolean
  /** Group by type */
  groupByType: boolean
}

/**
 * Outline configuration
 */
export interface OutlineConfig extends BaseTransformConfig {
  /** Maximum depth of headings */
  maxDepth: number
  /** Outline style */
  style: 'alphanumeric' | 'decimal' | 'roman' | 'bullets'
  /** Include descriptions */
  includeDescriptions: boolean
}

/**
 * Union type mapping transformation types to their config types
 */
export interface TransformConfigMap {
  podcast: PodcastConfig
  quiz: QuizConfig
  takeaways: TakeawaysConfig
  email: EmailConfig
  slidedeck: SlideDeckConfig
  report: ReportConfig
  datatable: DataTableConfig
  mindmap: MindMapConfig
  flashcards: FlashcardsConfig
  timeline: TimelineConfig
  glossary: GlossaryConfig
  comparison: ComparisonConfig
  faq: FAQConfig
  actionitems: ActionItemsConfig
  executivebrief: ExecutiveBriefConfig
  studyguide: StudyGuideConfig
  proscons: ProsConsConfig
  citations: CitationsConfig
  outline: OutlineConfig
}

/**
 * Generic transformation config - type-safe based on transformation type
 */
export type TransformConfig<T extends TransformationType> = TransformConfigMap[T]

/**
 * Storage for all user transformation configs
 */
export interface TransformConfigSettings {
  configs: Partial<TransformConfigMap>
}
