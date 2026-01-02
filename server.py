# -*- coding: utf-8 -*-
import os
import io
import base64
import json
import sys
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai

# Hardcoded API key for testing to avoid .env.local issues
api_key = "AIzaSyD0pUz8CDTM4XW1ga9S-pqLOrWgLHHU5Xc"

if api_key:
    print(f"API Key loaded (first 4): {api_key[:4]}")

genai.configure(api_key=api_key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    image_base64: str
    mode: str
    type: Optional[str] = None

@app.post("/api/analyze")
async def analyze_image(request: AnalyzeRequest):
    try:
        print(f"--- New Request ---"); sys.stdout.flush()
        print(f"Mode: {request.mode}, Type: {request.type}"); sys.stdout.flush()
        
        if "," in request.image_base64:
            encoded = request.image_base64.split(",", 1)[1]
        else:
            encoded = request.image_base64
        
        image_bytes = base64.b64decode(encoded)
        print(f"Image decoded. Size: {len(image_bytes)} bytes"); sys.stdout.flush()
        
        # 切換到 Gemini 2.0 Flash (目前最快且配額最新的型號)
        model_name = 'gemini-2.0-flash-exp'
        print(f"Using model: {model_name}"); sys.stdout.flush()
        model = genai.GenerativeModel(model_name)
        
        if request.mode == 'identity':
            prompt = "Identify device nameplate: brand (maker), model (model), serial number (serial_number). Return JSON: {\"maker\": \"...\", \"model\": \"...\", \"serial_number\": \"...\"}. No markdown."
        else:
            prompt = f"Identify value and unit for this {request.type} instrument. Return JSON: " + "{\"value\": \"...\", \"unit\": \"...\"}. No markdown."

        print(f"Sending prompt: {prompt}"); sys.stdout.flush()
        try:
            response = model.generate_content([
                prompt,
                {"mime_type": "image/jpeg", "data": image_bytes}
            ])
            print("Model call successful"); sys.stdout.flush()
            text = response.text.strip()
        except Exception as api_err:
            err_msg = str(api_err)
            print(f"Gemini API Error: {err_msg}"); sys.stdout.flush()
            if "429" in err_msg or "quota" in err_msg.lower():
                return {"error": "quota_exceeded", "message": "AI 辨識太頻繁了 (免費版 API 限制)，請休息 10~20 秒再拍下一張哦！"}
            if "400" in err_msg:
                return {"error": "bad_request", "message": "辨識失敗 (圖片不清晰或連線中斷)，請重新拍攝"}
            return {"error": "api_error", "message": f"AI 辨識異常: {err_msg[:100]}..." }

        print(f"Raw Model response: {text}"); sys.stdout.flush()
        
        # Clean up Markdown formatting if present
        if "```" in text:
            parts = text.split("```")
            if len(parts) > 1:
                text = parts[1]
                if text.startswith("json"):
                    text = text[4:]
        
        try:
            result = json.loads(text.strip())
            print(f"Parsed Result: {result}")
            return result
        except json.JSONDecodeError as je:
            print(f"JSON Parse Error: {str(je)} for text: {text}")
            return {"error": "parse_error", "message": "辨識結果內容解析失敗"}

    except Exception as e:
        import traceback
        with open('traceback.txt', 'a', encoding='utf-8') as tf:
            tf.write(f"\n\n--- Error at {request.mode} ---\n")
            traceback.print_exc(file=tf)
        print(f"CRITICAL ERROR: {str(e)}")
        # Return as JSON rather than raising 500 to keep the mobile UI alive
        return {"error": "server_error", "message": f"伺服器內部異常: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

