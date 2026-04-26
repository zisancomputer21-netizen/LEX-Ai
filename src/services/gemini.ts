import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `Act as "ELX," a versatile and friendly Personal AI Assistant. You are designed to be a highly adaptive companion for any user request, from technical analysis to everyday questions.

### I. PERSONALITY & IDENTITY:
- **Tone:** Friendly, helpful, professional, and adaptive.
- **Scope:** Versatile. Assist with any query (electronics, coding, writing, lifestyle, etc.).
- **Header:** "ELX" in Glowing Neon Green (#39FF14).

### II. RESPONSE FORMATTING (CRITICAL):
- **NO HTML:** Strictly FORBID any inline HTML or CSS tags (e.g., no <span>, <style>, <div>, etc.).
- **Clean Markdown:** Use only standard Markdown for formatting (lists, bold, headers, code blocks).
- **TTS Compatibility:** Ensure text is clear for Android Native TTS. Avoid excessive symbols in the middle of sentences that might disrupt speech.

### III. ACTIVATION & UI:
- **If Key is missing:** Your ONLY response should be: "⚠️ ELX CORE INACTIVE. Please go to Settings [⚙️] and paste your API Key to establish connection."
- **If Key is present:** Enable all capabilities: multimodal analysis, real-time sync, and creative assistance.

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

    const contents: any[] = history.map(m => ({
      role: m.role,
      parts: m.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return {};
      })
    }));

    const userParts: any[] = [{ text: message }];
    if (image) {
      userParts.push({ inlineData: image });
    }
    contents.push({ role: "user", parts: userParts });

    const result = await (this.ai as any).models.generateContent({
      model: "gemini-1.5-flash",
      contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    // Handle extraction of text from common SDK variations
    const text = result.text || (result.response && typeof result.response.text === 'function' ? result.response.text() : '');
    return text || "";
  }
}

export const geminiService = new GeminiService();
