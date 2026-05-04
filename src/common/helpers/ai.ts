import { GoogleGenAI } from "@google/genai";


const parseAiResponse = (response: string) => {
    const cleanJson = response.replace(/```json|```/g, '').trim();
    const parsedResponse = JSON.parse(cleanJson);
    return parsedResponse;
}

export const GEMINI_FREE_MODELS = {
    // מודלים מסדרת 3.1 (הכי חדשים)
    GEMINI_3_1_FLASH_LITE: "gemini-3.1-flash-lite-preview", // הכי מהיר וחסכוני
    GEMINI_3_1_PRO: "gemini-3.1-pro-preview",               // הכי חכם, מכסה נמוכה

    // מודלים מסדרת 3.0
    GEMINI_3_FLASH: "gemini-3-flash-preview",              // איזון מעולה לשימוש יומיומי

    // מודלים מסדרת 2.5
    GEMINI_2_5_FLASH: "gemini-2.5-flash",

    // מודלים מסדרת 1.5 (Stable)
    GEMINI_1_5_FLASH: "gemini-1.5-flash",
    GEMINI_1_5_PRO: "gemini-1.5-pro",

    // מודלי Gemma 4 (Instruction Tuned)
    GEMMA_4_31B: "gemma-4-31b-it",
    GEMMA_4_26B_MOE: "gemma-4-26b-a4b-it",
    GEMMA_4_9B: "gemma-4-9b-it"
} as const;

export const askAi = async <T>(prompt: string): Promise<T | undefined> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: GEMINI_FREE_MODELS.GEMINI_3_FLASH,
            contents: prompt,

        });

        if (response.text) {
            return parseAiResponse(response.text);
        }
    } catch (error) {
        console.error('Failed to ask ai: ', error);
        throw new Error('Failed to ask ai: ' + error.message);
    }
}

export const getEmbedding = async (text: string): Promise<number[]> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.embedContent({
            model: "gemini-embedding-001",
            contents: text,
        });

        if (!response.embeddings || response.embeddings.length === 0) {
            console.error('Failed to generate embedding: No embeddings returned.');
            throw new Error("Failed to generate embedding: No embeddings returned.");
        }

        return response.embeddings[0].values!;
    } catch (error) {
        console.error('Failed to get embedding: ', error);
        throw new Error('Failed to get embedding: ' + error.message);
    }
};
