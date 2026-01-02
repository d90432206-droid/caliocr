
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// 這裡模擬呼叫您的 Python 後端
const USE_PYTHON_BACKEND = true; // 開發階段可切換

const API_BASE = import.meta.env.VITE_API_URL || '';

export const analyzeInstrument = async (base64Image: string, mode: 'identity' | 'reading', type?: string) => {
  if (USE_PYTHON_BACKEND) {
    const response = await fetch(`${API_BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64Image, mode, type })
    });
    return response.json();
  }

  // Fallback 到 JS SDK (Gemini 3 Flash)
  const modelName = 'gemini-3-flash-preview';
  const prompt = mode === 'identity'
    ? "辨識設備銘牌：廠牌(maker)、型號(model)、序號(serial_number)。回傳 JSON。"
    : `辨識這張 ${type} 儀表的讀數與單位。特別優化 LCD 斷碼數字辨識。回傳 JSON。`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: mode === 'identity' ? {
        type: Type.OBJECT,
        properties: {
          maker: { type: Type.STRING },
          model: { type: Type.STRING },
          serial_number: { type: Type.STRING }
        }
      } : {
        type: Type.OBJECT,
        properties: {
          value: { type: Type.STRING },
          unit: { type: Type.STRING }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
};
