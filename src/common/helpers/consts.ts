export const FILE_TYPES_MAP = {
    pdf: 'pdf',
    docx: 'docx'
}

export const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

export const PII_REGEX_MAP: Record<string, RegExp> = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    URL: /https?:\/\/[^\s]+/g,
    PHONE: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}?\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
};