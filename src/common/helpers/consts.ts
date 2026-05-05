export const FILE_TYPES_MAP = {
    pdf: 'pdf',
    docx: 'docx'
}

export const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export const CV_CHECK_PATTERNS = {
    EMAIL: /[\w-\.]+@([\w-]+\.)+[\w-]{2,4}/,
    LINKEDIN: /linkedin\.com\/in\/[\w-]+/,
    GITHUB: /github\.com\/[\w-]+/,
    METRICS: /\b\d+(?:\,\d+)*\.?\d*%?|\d+\+|\$[\d\.]+[kmbKMB]?/g,
    BULLET: /^[•\-\*◦]/m,
    DATE_NUMERIC: /\d{2}\/\d{4}/,
    DATE_TEXTUAL: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i,
    PHONE: /\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/
};

export const ANALYSIS_METRICS = {
    ATS: 'ats',
    LAYOUT: 'layout',
    KEYWORDS: 'keywords',
    IMPACT: 'impact'
}

export const METRICS_WEIGHTS = {
    [ANALYSIS_METRICS.ATS]: 0.2,
    [ANALYSIS_METRICS.LAYOUT]: 0.2,
    [ANALYSIS_METRICS.KEYWORDS]: 0.25,
    [ANALYSIS_METRICS.IMPACT]: 0.35
}