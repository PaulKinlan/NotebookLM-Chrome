/**
 * Transform Configuration Storage and Defaults
 *
 * Provides default configurations for all transformation types and
 * utilities to get/save user configurations to chrome.storage.local
 */

import type {
  TransformationType,
  TransformConfigMap,
  PodcastConfig,
  QuizConfig,
  TakeawaysConfig,
  EmailConfig,
  SlideDeckConfig,
  ReportConfig,
  DataTableConfig,
  MindMapConfig,
  FlashcardsConfig,
  TimelineConfig,
  GlossaryConfig,
  ComparisonConfig,
  FAQConfig,
  ActionItemsConfig,
  ExecutiveBriefConfig,
  StudyGuideConfig,
  ProsConsConfig,
  CitationsConfig,
  OutlineConfig,
} from '../types/index.ts'

// ============================================================================
// Default Configurations
// ============================================================================

export const DEFAULT_PODCAST_CONFIG: PodcastConfig = {
  lengthMinutes: 5,
  tone: 'casual',
  speakerCount: 2,
  customInstructions: '',
}

export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  questionCount: 5,
  difficulty: 'medium',
  questionTypes: ['multiple-choice'],
  includeExplanations: true,
  customInstructions: '',
}

export const DEFAULT_TAKEAWAYS_CONFIG: TakeawaysConfig = {
  pointCount: 5,
  format: 'bullets',
  includeDetails: true,
  customInstructions: '',
}

export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  tone: 'professional',
  length: 'standard',
  includeCallToAction: false,
  customInstructions: '',
}

export const DEFAULT_SLIDEDECK_CONFIG: SlideDeckConfig = {
  slideCount: 10,
  style: 'detailed',
  includeSpeakerNotes: true,
  customInstructions: '',
}

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  format: 'business',
  sections: ['executive-summary', 'introduction', 'findings', 'conclusions'],
  length: 'standard',
  customInstructions: '',
}

export const DEFAULT_DATATABLE_CONFIG: DataTableConfig = {
  maxColumns: 5,
  maxRows: 20,
  includeSummary: true,
  customInstructions: '',
}

export const DEFAULT_MINDMAP_CONFIG: MindMapConfig = {
  maxDepth: 3,
  maxNodesPerBranch: 5,
  layout: 'radial',
  customInstructions: '',
}

export const DEFAULT_FLASHCARDS_CONFIG: FlashcardsConfig = {
  cardCount: 10,
  difficulty: 'medium',
  cardStyle: 'question-answer',
  includeHints: false,
  customInstructions: '',
}

export const DEFAULT_TIMELINE_CONFIG: TimelineConfig = {
  layout: 'vertical',
  maxEvents: 15,
  includeDescriptions: true,
  groupByCategory: false,
  customInstructions: '',
}

export const DEFAULT_GLOSSARY_CONFIG: GlossaryConfig = {
  definitionLength: 'standard',
  includeExamples: true,
  includeRelatedTerms: false,
  sortOrder: 'alphabetical',
  customInstructions: '',
}

export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
  maxItems: 4,
  format: 'table',
  includeRecommendation: true,
  customInstructions: '',
}

export const DEFAULT_FAQ_CONFIG: FAQConfig = {
  questionCount: 10,
  answerLength: 'standard',
  questionStyle: 'conversational',
  groupByTopic: true,
  customInstructions: '',
}

export const DEFAULT_ACTIONITEMS_CONFIG: ActionItemsConfig = {
  includePriority: true,
  priorityFormat: 'high-medium-low',
  includeTimeframes: false,
  groupByCategory: true,
  customInstructions: '',
}

export const DEFAULT_EXECUTIVEBRIEF_CONFIG: ExecutiveBriefConfig = {
  length: 'one-page',
  sections: ['overview', 'key-findings', 'recommendations'],
  customInstructions: '',
}

export const DEFAULT_STUDYGUIDE_CONFIG: StudyGuideConfig = {
  depth: 'standard',
  sections: ['summary', 'key-concepts', 'practice-questions'],
  audienceLevel: 'intermediate',
  customInstructions: '',
}

export const DEFAULT_PROSCONS_CONFIG: ProsConsConfig = {
  format: 'lists',
  includeNeutral: false,
  includeAssessment: true,
  weighImportance: false,
  customInstructions: '',
}

export const DEFAULT_CITATIONS_CONFIG: CitationsConfig = {
  styles: ['apa', 'mla', 'chicago'],
  includeAnnotations: false,
  groupByType: false,
  customInstructions: '',
}

export const DEFAULT_OUTLINE_CONFIG: OutlineConfig = {
  maxDepth: 3,
  style: 'alphanumeric',
  includeDescriptions: true,
  customInstructions: '',
}

/**
 * All default configurations indexed by transformation type
 */
export const DEFAULT_CONFIGS: TransformConfigMap = {
  podcast: DEFAULT_PODCAST_CONFIG,
  quiz: DEFAULT_QUIZ_CONFIG,
  takeaways: DEFAULT_TAKEAWAYS_CONFIG,
  email: DEFAULT_EMAIL_CONFIG,
  slidedeck: DEFAULT_SLIDEDECK_CONFIG,
  report: DEFAULT_REPORT_CONFIG,
  datatable: DEFAULT_DATATABLE_CONFIG,
  mindmap: DEFAULT_MINDMAP_CONFIG,
  flashcards: DEFAULT_FLASHCARDS_CONFIG,
  timeline: DEFAULT_TIMELINE_CONFIG,
  glossary: DEFAULT_GLOSSARY_CONFIG,
  comparison: DEFAULT_COMPARISON_CONFIG,
  faq: DEFAULT_FAQ_CONFIG,
  actionitems: DEFAULT_ACTIONITEMS_CONFIG,
  executivebrief: DEFAULT_EXECUTIVEBRIEF_CONFIG,
  studyguide: DEFAULT_STUDYGUIDE_CONFIG,
  proscons: DEFAULT_PROSCONS_CONFIG,
  citations: DEFAULT_CITATIONS_CONFIG,
  outline: DEFAULT_OUTLINE_CONFIG,
}

// ============================================================================
// Human-readable Labels for Config Options
// ============================================================================

export const CONFIG_LABELS = {
  // Podcast
  podcast: {
    title: 'Podcast Script Settings',
    fields: {
      lengthMinutes: { label: 'Duration (minutes)', type: 'number', min: 1, max: 30 },
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { value: 'casual', label: 'Casual & Friendly' },
          { value: 'professional', label: 'Professional' },
          { value: 'educational', label: 'Educational' },
          { value: 'entertaining', label: 'Entertaining' },
        ],
      },
      speakerCount: {
        label: 'Number of Speakers',
        type: 'select',
        options: [
          { value: 2, label: '2 Speakers' },
          { value: 3, label: '3 Speakers' },
        ],
      },
      speakerNames: { label: 'Speaker Names (comma-separated)', type: 'text', placeholder: 'e.g., Alex, Jordan' },
      focusArea: { label: 'Focus Area', type: 'text', placeholder: 'e.g., technical details, practical applications' },
    },
  },

  // Quiz
  quiz: {
    title: 'Quiz Settings',
    fields: {
      questionCount: { label: 'Number of Questions', type: 'number', min: 1, max: 20 },
      difficulty: {
        label: 'Difficulty',
        type: 'select',
        options: [
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
          { value: 'mixed', label: 'Mixed' },
        ],
      },
      questionTypes: {
        label: 'Question Types',
        type: 'multiselect',
        options: [
          { value: 'multiple-choice', label: 'Multiple Choice' },
          { value: 'true-false', label: 'True/False' },
        ],
      },
      includeExplanations: { label: 'Include Explanations', type: 'checkbox' },
    },
  },

  // Key Takeaways
  takeaways: {
    title: 'Key Takeaways Settings',
    fields: {
      pointCount: { label: 'Number of Points', type: 'number', min: 3, max: 15 },
      format: {
        label: 'Format',
        type: 'select',
        options: [
          { value: 'bullets', label: 'Bullet Points' },
          { value: 'numbered', label: 'Numbered List' },
          { value: 'paragraphs', label: 'Paragraphs' },
        ],
      },
      includeDetails: { label: 'Include Supporting Details', type: 'checkbox' },
    },
  },

  // Email Summary
  email: {
    title: 'Email Summary Settings',
    fields: {
      tone: {
        label: 'Tone',
        type: 'select',
        options: [
          { value: 'formal', label: 'Formal' },
          { value: 'casual', label: 'Casual' },
          { value: 'professional', label: 'Professional' },
        ],
      },
      length: {
        label: 'Length',
        type: 'select',
        options: [
          { value: 'brief', label: 'Brief' },
          { value: 'standard', label: 'Standard' },
          { value: 'detailed', label: 'Detailed' },
        ],
      },
      includeCallToAction: { label: 'Include Call to Action', type: 'checkbox' },
      recipientContext: { label: 'Recipient Context', type: 'text', placeholder: 'e.g., for my manager, for the team' },
    },
  },

  // Slide Deck
  slidedeck: {
    title: 'Slide Deck Settings',
    fields: {
      slideCount: { label: 'Number of Slides', type: 'number', min: 3, max: 30 },
      style: {
        label: 'Style',
        type: 'select',
        options: [
          { value: 'minimal', label: 'Minimal' },
          { value: 'detailed', label: 'Detailed' },
          { value: 'visual', label: 'Visual-focused' },
        ],
      },
      includeSpeakerNotes: { label: 'Include Speaker Notes', type: 'checkbox' },
    },
  },

  // Report
  report: {
    title: 'Report Settings',
    fields: {
      format: {
        label: 'Format',
        type: 'select',
        options: [
          { value: 'academic', label: 'Academic' },
          { value: 'business', label: 'Business' },
          { value: 'technical', label: 'Technical' },
          { value: 'executive', label: 'Executive' },
        ],
      },
      sections: {
        label: 'Sections to Include',
        type: 'multiselect',
        options: [
          { value: 'executive-summary', label: 'Executive Summary' },
          { value: 'introduction', label: 'Introduction' },
          { value: 'findings', label: 'Findings' },
          { value: 'analysis', label: 'Analysis' },
          { value: 'conclusions', label: 'Conclusions' },
          { value: 'recommendations', label: 'Recommendations' },
        ],
      },
      length: {
        label: 'Length',
        type: 'select',
        options: [
          { value: 'brief', label: 'Brief' },
          { value: 'standard', label: 'Standard' },
          { value: 'comprehensive', label: 'Comprehensive' },
        ],
      },
    },
  },

  // Data Table
  datatable: {
    title: 'Data Table Settings',
    fields: {
      maxColumns: { label: 'Max Columns', type: 'number', min: 2, max: 10 },
      maxRows: { label: 'Max Rows', type: 'number', min: 5, max: 50 },
      includeSummary: { label: 'Include Summary Row', type: 'checkbox' },
    },
  },

  // Mind Map
  mindmap: {
    title: 'Mind Map Settings',
    fields: {
      maxDepth: { label: 'Max Depth', type: 'number', min: 2, max: 5 },
      maxNodesPerBranch: { label: 'Max Nodes per Branch', type: 'number', min: 2, max: 10 },
      layout: {
        label: 'Layout',
        type: 'select',
        options: [
          { value: 'radial', label: 'Radial' },
          { value: 'tree', label: 'Tree' },
          { value: 'organic', label: 'Organic' },
        ],
      },
    },
  },

  // Flashcards
  flashcards: {
    title: 'Flashcard Settings',
    fields: {
      cardCount: { label: 'Number of Cards', type: 'number', min: 5, max: 30 },
      difficulty: {
        label: 'Difficulty',
        type: 'select',
        options: [
          { value: 'easy', label: 'Easy' },
          { value: 'medium', label: 'Medium' },
          { value: 'hard', label: 'Hard' },
          { value: 'mixed', label: 'Mixed' },
        ],
      },
      cardStyle: {
        label: 'Card Style',
        type: 'select',
        options: [
          { value: 'question-answer', label: 'Question & Answer' },
          { value: 'term-definition', label: 'Term & Definition' },
          { value: 'concept-example', label: 'Concept & Example' },
        ],
      },
      includeHints: { label: 'Include Hints', type: 'checkbox' },
    },
  },

  // Timeline
  timeline: {
    title: 'Timeline Settings',
    fields: {
      layout: {
        label: 'Layout',
        type: 'select',
        options: [
          { value: 'vertical', label: 'Vertical' },
          { value: 'horizontal', label: 'Horizontal' },
        ],
      },
      maxEvents: { label: 'Max Events', type: 'number', min: 5, max: 30 },
      includeDescriptions: { label: 'Include Descriptions', type: 'checkbox' },
      groupByCategory: { label: 'Group by Category', type: 'checkbox' },
    },
  },

  // Glossary
  glossary: {
    title: 'Glossary Settings',
    fields: {
      definitionLength: {
        label: 'Definition Length',
        type: 'select',
        options: [
          { value: 'concise', label: 'Concise' },
          { value: 'standard', label: 'Standard' },
          { value: 'detailed', label: 'Detailed' },
        ],
      },
      includeExamples: { label: 'Include Examples', type: 'checkbox' },
      includeRelatedTerms: { label: 'Include Related Terms', type: 'checkbox' },
      sortOrder: {
        label: 'Sort Order',
        type: 'select',
        options: [
          { value: 'alphabetical', label: 'Alphabetical' },
          { value: 'by-importance', label: 'By Importance' },
          { value: 'by-category', label: 'By Category' },
        ],
      },
    },
  },

  // Comparison
  comparison: {
    title: 'Comparison Settings',
    fields: {
      maxItems: { label: 'Max Items to Compare', type: 'number', min: 2, max: 6 },
      format: {
        label: 'Format',
        type: 'select',
        options: [
          { value: 'table', label: 'Table' },
          { value: 'side-by-side', label: 'Side by Side' },
          { value: 'prose', label: 'Prose' },
        ],
      },
      includeRecommendation: { label: 'Include Recommendation', type: 'checkbox' },
    },
  },

  // FAQ
  faq: {
    title: 'FAQ Settings',
    fields: {
      questionCount: { label: 'Number of Questions', type: 'number', min: 5, max: 20 },
      answerLength: {
        label: 'Answer Length',
        type: 'select',
        options: [
          { value: 'brief', label: 'Brief' },
          { value: 'standard', label: 'Standard' },
          { value: 'detailed', label: 'Detailed' },
        ],
      },
      questionStyle: {
        label: 'Question Style',
        type: 'select',
        options: [
          { value: 'formal', label: 'Formal' },
          { value: 'conversational', label: 'Conversational' },
        ],
      },
      groupByTopic: { label: 'Group by Topic', type: 'checkbox' },
    },
  },

  // Action Items
  actionitems: {
    title: 'Action Items Settings',
    fields: {
      includePriority: { label: 'Include Priority Levels', type: 'checkbox' },
      priorityFormat: {
        label: 'Priority Format',
        type: 'select',
        options: [
          { value: 'high-medium-low', label: 'High / Medium / Low' },
          { value: 'p1-p2-p3', label: 'P1 / P2 / P3' },
          { value: 'urgent-normal-low', label: 'Urgent / Normal / Low' },
        ],
      },
      includeTimeframes: { label: 'Include Timeframes', type: 'checkbox' },
      groupByCategory: { label: 'Group by Category', type: 'checkbox' },
    },
  },

  // Executive Brief
  executivebrief: {
    title: 'Executive Brief Settings',
    fields: {
      length: {
        label: 'Length',
        type: 'select',
        options: [
          { value: 'half-page', label: 'Half Page' },
          { value: 'one-page', label: 'One Page' },
          { value: 'two-pages', label: 'Two Pages' },
        ],
      },
      sections: {
        label: 'Sections to Include',
        type: 'multiselect',
        options: [
          { value: 'overview', label: 'Overview' },
          { value: 'key-findings', label: 'Key Findings' },
          { value: 'implications', label: 'Implications' },
          { value: 'recommendations', label: 'Recommendations' },
          { value: 'next-steps', label: 'Next Steps' },
        ],
      },
      focusArea: { label: 'Focus Area', type: 'text', placeholder: 'e.g., financial impact, risk assessment' },
    },
  },

  // Study Guide
  studyguide: {
    title: 'Study Guide Settings',
    fields: {
      depth: {
        label: 'Depth',
        type: 'select',
        options: [
          { value: 'overview', label: 'Overview' },
          { value: 'standard', label: 'Standard' },
          { value: 'comprehensive', label: 'Comprehensive' },
        ],
      },
      sections: {
        label: 'Sections to Include',
        type: 'multiselect',
        options: [
          { value: 'summary', label: 'Summary' },
          { value: 'key-concepts', label: 'Key Concepts' },
          { value: 'examples', label: 'Examples' },
          { value: 'practice-questions', label: 'Practice Questions' },
          { value: 'resources', label: 'Resources' },
        ],
      },
      audienceLevel: {
        label: 'Audience Level',
        type: 'select',
        options: [
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ],
      },
    },
  },

  // Pros & Cons
  proscons: {
    title: 'Pros & Cons Settings',
    fields: {
      format: {
        label: 'Format',
        type: 'select',
        options: [
          { value: 'table', label: 'Table' },
          { value: 'lists', label: 'Lists' },
          { value: 'detailed', label: 'Detailed' },
        ],
      },
      includeNeutral: { label: 'Include Neutral Points', type: 'checkbox' },
      includeAssessment: { label: 'Include Overall Assessment', type: 'checkbox' },
      weighImportance: { label: 'Weigh by Importance', type: 'checkbox' },
    },
  },

  // Citations
  citations: {
    title: 'Citation List Settings',
    fields: {
      styles: {
        label: 'Citation Styles',
        type: 'multiselect',
        options: [
          { value: 'apa', label: 'APA' },
          { value: 'mla', label: 'MLA' },
          { value: 'chicago', label: 'Chicago' },
          { value: 'harvard', label: 'Harvard' },
          { value: 'ieee', label: 'IEEE' },
        ],
      },
      includeAnnotations: { label: 'Include Annotations', type: 'checkbox' },
      groupByType: { label: 'Group by Source Type', type: 'checkbox' },
    },
  },

  // Outline
  outline: {
    title: 'Outline Settings',
    fields: {
      maxDepth: { label: 'Max Depth', type: 'number', min: 2, max: 5 },
      style: {
        label: 'Style',
        type: 'select',
        options: [
          { value: 'alphanumeric', label: 'Alphanumeric (I, A, 1, a)' },
          { value: 'decimal', label: 'Decimal (1.1, 1.2)' },
          { value: 'roman', label: 'Roman (I, II, III)' },
          { value: 'bullets', label: 'Bullets' },
        ],
      },
      includeDescriptions: { label: 'Include Descriptions', type: 'checkbox' },
    },
  },
} as const

// ============================================================================
// Prompt Information
// ============================================================================

/**
 * Information about what each transformation's AI prompt does.
 * Shown in the "Advanced" section of the config popover.
 */
export const PROMPT_INFO: Record<TransformationType, { description: string, structure: string }> = {
  podcast: {
    description: 'Generates a conversational podcast script with multiple speakers discussing the source material.',
    structure: 'System: Sets tone and duration constraints → Prompt: Provides source context with speaker format template',
  },
  quiz: {
    description: 'Creates quiz questions based on the source content with configurable difficulty and question types.',
    structure: 'System: Defines quiz format and difficulty → Prompt: Asks for questions with answer key and optional explanations',
  },
  takeaways: {
    description: 'Extracts and summarizes the most important points from the source material.',
    structure: 'System: Prioritization instructions → Prompt: Requests key points in specified format with supporting details',
  },
  email: {
    description: 'Composes a professional email summarizing the source content for specified recipients.',
    structure: 'System: Sets tone and formality → Prompt: Structures email with subject, body, and optional call-to-action',
  },
  slidedeck: {
    description: 'Creates slide presentation content with structured sections and optional speaker notes.',
    structure: 'System: Defines presentation style → Prompt: Generates slides with titles, bullets, and visual cues',
  },
  report: {
    description: 'Produces a structured report with customizable sections based on chosen format.',
    structure: 'System: Sets report format (academic/business/technical) → Prompt: Organizes content into selected sections',
  },
  datatable: {
    description: 'Extracts structured data from sources and organizes it into a tabular format.',
    structure: 'System: Table structure constraints → Prompt: Identifies data relationships and formats as Markdown table',
  },
  mindmap: {
    description: 'Creates a hierarchical mind map structure showing relationships between concepts.',
    structure: 'System: Depth and layout instructions → Prompt: Generates nested structure with central topic and branches',
  },
  flashcards: {
    description: 'Generates study flashcards with front (question/term) and back (answer/definition) sides.',
    structure: 'System: Card style and difficulty → Prompt: Creates cards in specified format with optional hints',
  },
  timeline: {
    description: 'Constructs a chronological timeline of events, dates, or milestones from the sources.',
    structure: 'System: Layout and grouping rules → Prompt: Extracts temporal data and formats as timeline entries',
  },
  glossary: {
    description: 'Compiles a glossary of key terms and their definitions from the source material.',
    structure: 'System: Definition style and sorting → Prompt: Identifies terms and generates definitions with examples',
  },
  comparison: {
    description: 'Creates a comparative analysis of items, concepts, or options found in the sources.',
    structure: 'System: Comparison format rules → Prompt: Identifies items to compare and evaluates across criteria',
  },
  faq: {
    description: 'Generates frequently asked questions and answers based on the source content.',
    structure: 'System: Question style and depth → Prompt: Anticipates questions and provides informative answers',
  },
  actionitems: {
    description: 'Extracts actionable tasks and to-dos from the source material with optional prioritization.',
    structure: 'System: Priority format and grouping → Prompt: Identifies action items with owners and timeframes',
  },
  executivebrief: {
    description: 'Creates a concise executive summary for decision-makers with key findings and recommendations.',
    structure: 'System: Length and focus constraints → Prompt: Synthesizes content into actionable brief with sections',
  },
  studyguide: {
    description: 'Generates an interactive HTML study guide with collapsible sections and practice questions.',
    structure: 'System: Depth and audience level → Prompt: Creates structured guide with HTML/CSS/JS interactivity',
  },
  proscons: {
    description: 'Analyzes pros and cons of topics in the sources with optional weighted importance.',
    structure: 'System: Format and assessment rules → Prompt: Identifies advantages/disadvantages with optional verdict',
  },
  citations: {
    description: 'Generates properly formatted citations for sources in multiple academic styles.',
    structure: 'System: Citation format rules → Prompt: Extracts metadata and formats in selected citation styles',
  },
  outline: {
    description: 'Creates a hierarchical outline of the source material with configurable numbering style.',
    structure: 'System: Outline style and depth → Prompt: Organizes content into hierarchical structure with headings',
  },
}

// ============================================================================
// Storage Functions
// ============================================================================

const STORAGE_KEY_PREFIX = 'transformConfigs_'

/**
 * Get the storage key for a specific notebook's transform configs
 */
function getStorageKey(notebookId: string): string {
  return `${STORAGE_KEY_PREFIX}${notebookId}`
}

/**
 * Get the configuration for a specific transformation type within a notebook
 * Returns the user's saved config merged with defaults
 */
export async function getTransformConfig<T extends TransformationType>(
  type: T,
  notebookId: string,
): Promise<TransformConfigMap[T]> {
  const defaults = DEFAULT_CONFIGS[type]

  if (!notebookId) {
    console.warn('[TransformConfig] No notebookId provided, returning defaults')
    return defaults
  }

  try {
    const storageKey = getStorageKey(notebookId)
    const result = await chrome.storage.local.get(storageKey)
    const savedConfigs = result[storageKey] as Partial<TransformConfigMap> | undefined

    if (savedConfigs && savedConfigs[type]) {
      // Merge saved config with defaults (saved values take precedence)
      return { ...defaults, ...savedConfigs[type] } as TransformConfigMap[T]
    }
  }
  catch (err) {
    console.warn('[TransformConfig] Failed to load config:', err)
  }

  return defaults
}

/**
 * Save the configuration for a specific transformation type within a notebook
 */
export async function saveTransformConfig<T extends TransformationType>(
  type: T,
  config: Partial<TransformConfigMap[T]>,
  notebookId: string,
): Promise<void> {
  if (!notebookId) {
    console.error('[TransformConfig] Cannot save config without notebookId')
    throw new Error('notebookId is required to save transform config')
  }

  try {
    const storageKey = getStorageKey(notebookId)
    const result = await chrome.storage.local.get(storageKey)
    const savedConfigs = (result[storageKey] as Partial<TransformConfigMap>) || {}

    // Merge with existing config for this type
    savedConfigs[type] = { ...DEFAULT_CONFIGS[type], ...savedConfigs[type], ...config } as TransformConfigMap[T]

    await chrome.storage.local.set({ [storageKey]: savedConfigs })
  }
  catch (err) {
    console.error('[TransformConfig] Failed to save config:', err)
    throw err
  }
}

/**
 * Reset configuration for a specific transformation type to defaults within a notebook
 */
export async function resetTransformConfig<T extends TransformationType>(
  type: T,
  notebookId: string,
): Promise<TransformConfigMap[T]> {
  if (!notebookId) {
    console.warn('[TransformConfig] No notebookId provided, returning defaults')
    return DEFAULT_CONFIGS[type]
  }

  try {
    const storageKey = getStorageKey(notebookId)
    const result = await chrome.storage.local.get(storageKey)
    const savedConfigs = (result[storageKey] as Partial<TransformConfigMap>) || {}

    // Remove this type's config
    delete savedConfigs[type]

    await chrome.storage.local.set({ [storageKey]: savedConfigs })
  }
  catch (err) {
    console.error('[TransformConfig] Failed to reset config:', err)
  }

  return DEFAULT_CONFIGS[type]
}

/**
 * Get all saved configurations for a notebook
 */
export async function getAllTransformConfigs(notebookId: string): Promise<Partial<TransformConfigMap>> {
  if (!notebookId) {
    console.warn('[TransformConfig] No notebookId provided, returning empty configs')
    return {}
  }

  try {
    const storageKey = getStorageKey(notebookId)
    const result = await chrome.storage.local.get(storageKey)
    return (result[storageKey] as Partial<TransformConfigMap>) || {}
  }
  catch (err) {
    console.warn('[TransformConfig] Failed to load configs:', err)
    return {}
  }
}

/**
 * Check if a transformation type has custom configuration within a notebook
 */
export async function hasCustomConfig(type: TransformationType, notebookId: string): Promise<boolean> {
  if (!notebookId) {
    return false
  }

  try {
    const storageKey = getStorageKey(notebookId)
    const result = await chrome.storage.local.get(storageKey)
    const savedConfigs = result[storageKey] as Partial<TransformConfigMap> | undefined

    return savedConfigs !== null && savedConfigs !== undefined && savedConfigs[type] !== null && savedConfigs[type] !== undefined
  }
  catch {
    return false
  }
}

/**
 * Delete all transform configs for a notebook
 * Called when a notebook is deleted
 */
export async function deleteTransformConfigs(notebookId: string): Promise<void> {
  if (!notebookId) {
    return
  }

  try {
    const storageKey = getStorageKey(notebookId)
    await chrome.storage.local.remove(storageKey)
  }
  catch (err) {
    console.error('[TransformConfig] Failed to delete configs:', err)
  }
}
