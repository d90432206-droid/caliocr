
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface OCRResult {
  value: string;
  unit: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
}

export interface IdentityResult {
  maker: string;
  model: string;
  serial_number: string;
  reasoning: string;
}

// 辨識讀數：針對數位與類比混合優化
export const analyzeInstrumentReading = async (base64Image: string): Promise<OCRResult> => {
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      parts: [
        { 
          text: `你是一位資深的校正實驗室技術員。
請精確辨識影像中的量測讀數。
1. 若為 LCD 斷碼螢幕，請忽略可能的筆劃中斷，根據數字形狀進行語意補完。
2. 若為類比指針，請讀取最接近的刻度值。
3. 提取數值與單位（如 V, A, ℃, kgf, bar, psi）。
4. 只回傳 JSON 格式，不要有任何 Markdown 包裝。` 
        },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING, description: "辨識出的數值" },
          unit: { type: Type.STRING, description: "辨識出的單位" },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["value", "unit", "confidence", "reasoning"]
      }
    }
  });

  const result = JSON.parse(response.text || '{}');
  return { ...result, timestamp: new Date().toISOString() };
};

// 辨識設備銘牌
export const analyzeInstrumentIdentity = async (base64Image: string): Promise<IdentityResult> => {
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{
      parts: [
        { 
          text: `請提取設備銘牌 (Nameplate) 中的關鍵資訊：
- Maker: 廠牌/製造商
- Model: 型號
- Serial Number: 序號 (S/N)
若標籤包含多個條碼或序號，請優先選取 S/N 或 Serial 字樣後的內容。
回傳純 JSON。` 
        },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          maker: { type: Type.STRING },
          model: { type: Type.STRING },
          serial_number: { type: Type.STRING },
          reasoning: { type: Type.STRING }
        },
        required: ["maker", "model", "serial_number", "reasoning"]
      }
    }
  });

  return JSON.parse(response.text || '{}') as IdentityResult;
};
