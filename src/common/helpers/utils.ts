import { mimeMap } from "./consts";

export const getFileType = (mimeType: string) => {
    return mimeMap[mimeType] || 'unknown';
}

export const cleanText = (text: string): string => {
    return text
        .replace(/\s\s+/g, ' ')
        .replace(/\n\s+\n/g, '\n\n')
        .trim();
}