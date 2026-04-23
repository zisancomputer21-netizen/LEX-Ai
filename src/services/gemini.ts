import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `Act as "ELX," the core engine. You are bridging the connectivity gap between the user and advanced electronics analysis.

### I. ACTIVATION STATUS:
- **If Key is missing:** Your ONLY response should be: "⚠️ ELX CORE INACTIVE. Please go to Settings [⚙️] and paste your API Key to establish connection."
- **If Key is present:** Automatically initialize the ELX personality and enable all features (Multimodal, Electronics Analysis, TTS).

### II. BRANDING & THEME:
- **Header:** "ELX" in Glowing Neon Green (#39FF14).
- **Icons:** 
    - [🕒] History (inside Left Sidebar).
    - [📋] Copy (Double frame icon).
    - [🔊] TTS (Clean speaker icon).
    - [🌗] Mode Toggle (Dark/White).

### III. SPEECH (TTS) & ANALYSIS:
- **TTS:** Clean text only for Android Native engine. No markdown symbols (*, #).
- **Analysis:** Provide high-precision feedback for microcontrollers (like ESP32) only after activation.

### IV. PERFORMANCE:
- Maintain a stable, lightweight heartbeat. If connection fails, notify the user to verify their key and internet status.`;

export interface Message {
  id: string;
  role: "user" | "model";
  parts: { text?: string; inlineData?: { mimeType: string; data: string } }[];
}

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private currentApiKey: string | null = null;

  constructor() {
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
      this.updateApiKey(envKey);
    }
  }

  updateApiKey(key: string) {
    this.currentApiKey = key;
    this.ai = new GoogleGenAI({ apiKey: key });
  }

  hasKey() {
    return !!this.currentApiKey;
  }

  async chat(history: Message[], message: string, image?: { mimeType: string; data: string }) {
    if (!this.ai) {
      throw new Error("Please enter your API Key in the ELX Settings to activate my core.");
    }

    const parts: any[] = [{ text: message }];
    if (image) {
      parts.push({ inlineData: image });
    }

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...history.map(m => ({
          role: m.role,
          parts: m.parts.map(p => {
            if (p.text) return { text: p.text };
            if (p.inlineData) return { inlineData: p.inlineData };
            return {};
          })
        })),
        { role: "user", parts }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    return response.text || "";
  }
}

export const geminiService = new GeminiService();
