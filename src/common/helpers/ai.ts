import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

export const askAi = async (prompt: string) => {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
    });
    return response.text;
}