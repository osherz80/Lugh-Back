import { GoogleGenAI } from "@google/genai";


export const askAi = async (prompt: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,

    });
    return response.text;
}

export const askAiLite = async (prompt: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,

    });
    return response.text;
}

/**
 * Generates an embedding vector for the provided text using Gemini's embedding model.
 * @param text The text to embed.
 * @returns A promise that resolves to an array of numbers representing the embedding.
 */
export const getEmbedding = async (text: string): Promise<number[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
    });

    if (!response.embeddings || response.embeddings.length === 0) {
        throw new Error("Failed to generate embedding: No embeddings returned.");
    }

    return response.embeddings[0].values!;
};
