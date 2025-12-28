
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { MindMapNode, Slide, StudyNote } from "../types.ts";

/**
 * Helper function to decode base64 string to Uint8Array as recommended by guidelines.
 */
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const geminiService = {
  /**
   * Generates a hierarchical mind map based on provided context.
   */
  async generateMindMap(context: string): Promise<MindMapNode> {
    // Create new instance right before call to ensure latest API key
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a hierarchical mind map based on this study resource: "${context}". Return a JSON object with "name" and "children" properties.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            children: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING } } } }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  },

  /**
   * Generates structured study notes using AI.
   */
  async generateNotes(context: string): Promise<StudyNote> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write detailed, structured study notes based on this resource: "${context}". Use markdown formatting.`,
    });
    return { title: "AI Study Notes", body: response.text || '' };
  },

  /**
   * Generates educational slides in JSON format.
   */
  async generateSlides(context: string): Promise<Slide[]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 5 professional educational slides based on this resource: "${context}". Each slide needs a title and 3-4 bullet points.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '[]');
  },

  /**
   * Generates audio summary using Gemini TTS.
   */
  async generateAudioSummary(text: string): Promise<Uint8Array> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this study summary in a clear, encouraging educational voice: ${text.substring(0, 800)}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio generation failed");
    
    return decode(base64Audio);
  },

  /**
   * Generates a video lecture using Veo model.
   * Includes mandatory API key selection check and error handling.
   */
  async generateVideoLecture(prompt: string): Promise<string> {
    // Check for API key selection if needed for Veo models
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `A professional educational animation or lecture visualization about: ${prompt}. High quality, cinematic educational style.`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        // Polling interval updated to 10s as per guidelines
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      // Append API key to download link for authorized access
      return `${downloadLink}&key=${process.env.API_KEY}`;
    } catch (error: any) {
      // Handle specific "Requested entity was not found" error by prompting for key re-selection
      if (error?.message?.includes("Requested entity was not found.") || error?.status === 404) {
        if (typeof window !== 'undefined' && (window as any).aistudio) {
          await (window as any).aistudio.openSelectKey();
        }
      }
      throw error;
    }
  }
};
