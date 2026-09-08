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
            model: GEMINI_FREE_MODELS.GEMINI_3_1_FLASH_LITE,
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

export const askAiV2 = async <T>(
    systemPrompt: string,
    data: any,
    temp: number = 0.7,
    responseSchema?: any
): Promise<T> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


        const textContent = typeof data === 'object' ? JSON.stringify(data) : String(data);

        const response = await ai.models.generateContent({
            model: GEMINI_FREE_MODELS.GEMINI_3_1_FLASH_LITE,
            contents: textContent,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: responseSchema,
                temperature: temp
            }
        });

        if (response.text) {
            return parseAiResponse(response.text);
        } else {
            throw new Error('Failed to ask ai: No response text returned.');
        }
    } catch (error) {
        console.error('Failed to ask ai: ', error);
        throw new Error('Failed to ask ai: ' + error.message);
    }
}

export const getEmbedding = async (text: string): Promise<number[]> => {
    let embedding
    if (process.env.USE_LOCAL_MODEL === "true") {
        embedding = await getLocalEmbedding(text)
        embedding = embedding.slice(0, 256);
        return embedding
    }
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

        embedding = response.embeddings[0].values!;
        embedding = embedding.slice(0, 256);
        return embedding
    } catch (error) {
        console.error('Failed to get embedding: ', error);
        throw new Error('Failed to get embedding: ' + error.message);
    }
};

// הגדרת טיפוס עבור התשובה מהשרת (בתקן OpenAI)
interface EmbeddingResponse {
    object: string;
    data: {
        object: string;
        embedding: number[];
        index: number;
    }[];
    model: string;
    usage: {
        prompt_tokens: number;
        total_tokens: number;
    };
}

export const getLocalEmbedding = async (text: string): Promise<number[]> => {
    const response = await fetch("http://127.0.0.1:8000/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            input: text,
        }),
    });

    if (!response.ok) {
        throw new Error(`Error fetching embedding: ${response.statusText}`);
    }

    const data: EmbeddingResponse = await response.json();

    // החזרת הוקטור הראשון ברשימה
    return data.data[0].embedding;
}