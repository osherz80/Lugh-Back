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
    DATE_NUMERIC: /\d{2}\/\d{4}/,
    DATE_TEXTUAL: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/i,
    PHONE: /\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/
};