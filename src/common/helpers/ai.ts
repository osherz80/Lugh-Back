import { GoogleGenAI } from "@google/genai";


export const askAi = async (prompt: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,

    });
    return response.text;
}