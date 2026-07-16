import { GoogleGenAI, Type, Schema } from "@google/genai";
import { getApiKey } from "./apiKey";

const getClient = () => {
  const key = getApiKey();
  if (!key) throw new Error("No Gemini API key set. Add your key to use this tool.");
  return new GoogleGenAI({ apiKey: key });
};
import { StoryboardData, Frame } from "../types";

// Schema for the storyboard JSON output
const storyboardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    strategy: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "Catchy title for the video concept" },
        hook: { type: Type.STRING, description: "What happens in the first 3 seconds" },
        style: { type: Type.STRING, description: "Visual style (e.g., Gen Z Chaos, Corporate Sleek)" },
      },
      required: ["title", "hook", "style"],
    },
    frames: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          action: { type: Type.STRING, description: "Detailed description of movement/subject" },
          audio: { type: Type.STRING, description: "Spoken words + SFX in brackets" },
          textOverlay: { type: Type.STRING, description: "Text appearing on screen" },
          camera: { type: Type.STRING, description: "Angle, lens, movement" },
          imagePrompt: { 
            type: Type.STRING, 
            description: "A detailed visual description for the image generator. MUST REPEAT the main character's specific physical traits (e.g., 'A young Singaporean woman with long black hair in a red dress') in every single frame to ensure the same person appears." 
          },
        },
        required: ["id", "action", "audio", "textOverlay", "camera", "imagePrompt"],
      },
    },
    assets: {
      type: Type.OBJECT,
      properties: {
        music: { type: Type.STRING },
        props: { type: Type.ARRAY, items: { type: Type.STRING } },
        talent: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List specific character details (e.g., 'Singaporean Auntie, 50s')." },
      },
      required: ["music", "props", "talent"],
    },
  },
  required: ["strategy", "frames", "assets"],
};

export const generateStoryboardText = async (topic: string): Promise<StoryboardData> => {
  const ai = getClient();
  const prompt = `
    You are an elite Creative Director for a social-first agency based in Singapore. 
    Create a digital storyboard for a short-form vertical video about: "${topic}".
    
    Follow this structure:
    1. Strategy Card (Title, Hook, Style)
    2. Visual Sequence (3-6 key frames)
    3. Asset List (Music, Props, Talent)

    **CRITICAL VISUAL INSTRUCTIONS:**
    1. **CHARACTER CONSISTENCY IS PARAMOUNT.** 
       - Define a specific main character visual (e.g., "A young Singaporean male with messy black hair and round glasses").
       - **YOU MUST REPEAT this exact character description in the 'imagePrompt' of EVERY frame.** 
       - If the character changes appearance, the storyboard fails.
    
    2. **DEFAULT CONTEXT:**
       - Unless the user explicitly asks for a different setting, assume a **Singaporean context**. 
       - Use Singaporean visual cues (e.g., HDB void decks, kopitiams, lush tropical greenery, modern Singapore skyline, local Asian faces).

    3. **IMAGE PROMPT FORMAT:**
       - Start with "A cinematic vertical shot of [Character Description]..."
       - Describe the action and lighting.
       - Do NOT include text rendering instructions.
       - Do NOT use brand names.
       - Do NOT use real celebrities.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: storyboardSchema,
      systemInstruction: "You are a creative director. Output valid JSON only.",
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as StoryboardData;
};

export const updateStoryboardText = async (currentData: StoryboardData, updatePrompt: string): Promise<StoryboardData> => {
  const ai = getClient();
  
  // Create a simplified version of frames for context to save tokens, but we need IDs
  const context = JSON.stringify(currentData);

  const prompt = `
    You are a professional storyboard editor.
    
    Current Storyboard JSON:
    ${context}
    
    User Request: "${updatePrompt}"
    
    INSTRUCTIONS:
    1. Modify the storyboard based on the User Request.
    2. You can add, remove, reorder, or edit frames.
    3. **CRITICAL**: PRESERVE THE 'id' OF EXISTING FRAMES if they are retained (even if edited slightly). This preserves the generated images.
    4. If adding NEW frames, assign a NEW unique integer ID (must be different from existing IDs).
    5. Maintain the JSON structure exactly.
    6. Ensure the 'imagePrompt' for any NEW frames maintains the character consistency defined in the other frames.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: storyboardSchema,
      systemInstruction: "You are a storyboard editor. Update the JSON based on the user request. Output valid JSON only.",
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as StoryboardData;
};

export const generateFrameImage = async (prompt: string): Promise<string> => {
  const ai = getClient();
  try {
    // Clean prompt to ensure compatibility
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    
    // Check if there's a text refusal
    const textPart = response.text;
    if (textPart) {
      console.warn("Model returned text instead of image:", textPart);
      throw new Error(`Model refused to generate image: ${textPart.substring(0, 100)}...`);
    }

    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Image generation failed:", error);
    throw error;
  }
};

export const editFrameImage = async (base64Image: string, editInstruction: string): Promise<string> => {
  const ai = getClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image,
            },
          },
          {
            text: `Edit this image: ${editInstruction}. Keep it vertical 9:16.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "9:16"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    
    throw new Error("No edited image returned");
  } catch (error) {
    console.error("Image editing failed:", error);
    throw error;
  }
};