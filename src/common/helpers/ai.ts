import { GoogleGenAI } from "@google/genai";


const parseAiResponse = (response: string) => {
    const cleanJson = response.replace(/```json|```/g, '').trim();
    const parsedResponse = JSON.parse(cleanJson);
    return parsedResponse;
}

export const askAi = async <T>(prompt: string): Promise<T | undefined> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
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

export const askAiLite = async <T>(prompt: string): Promise<T | undefined> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,

        });

        if (response.text) {
            return parseAiResponse(response.text);
        }
    } catch (error) {
        console.error('Failed to ask ai lite: ', error);
        throw new Error('Failed to ask ai lite: ' + error.message);
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
