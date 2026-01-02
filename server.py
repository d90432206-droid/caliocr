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

# Gemini API Key (Gemini 2.0 Flash)
api_key = "AIzaSyBDIaeqHtNXkbkDuMkyTdJXDNyvO30-5N8"

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
        
        # 根據您的權限清單，僅嘗試這四種模型
        models_to_try = [
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash-tts',
            'gemini-3-flash'
        ]
        
        # 第一次啟動時列出所有可用模型 (輔助除錯)
        try:
            available_models = [m.name for m in genai.list_models()]
            print(f"Available models for this key: {available_models}"); sys.stdout.flush()
        except:
            pass
        
        last_error = ""
        for model_name in models_to_try:
            try:
                print(f"--- Attempting model: {model_name} ---"); sys.stdout.flush()
                model = genai.GenerativeModel(model_name)
                
                if request.mode == 'identity':
                    prompt = "Identify device nameplate: brand (maker), model (model), serial number (serial_number). Return JSON: {\"maker\": \"...\", \"model\": \"...\", \"serial_number\": \"...\"}. No markdown."
                else:
                    prompt = f"Identify value and unit for this {request.type} instrument. Return JSON: " + "{\"value\": \"...\", \"unit\": \"...\"}. No markdown."

                response = model.generate_content([
                    prompt,
                    {"mime_type": "image/jpeg", "data": image_bytes}
                ])
                
                text = response.text.strip()
                print(f"Model {model_name} success!"); sys.stdout.flush()
                break # 成功就跳出迴圈
                
            except Exception as api_err:
                last_error = str(api_err)
                print(f"Model {model_name} failed. Error: {last_error}"); sys.stdout.flush()
                continue
        else:
            # 如果所有模型都失敗
            print(f"All models failed. Last error: {last_error}"); sys.stdout.flush()
            if "429" in last_error or "quota" in last_error.lower():
                return {"error": "quota_exceeded", "message": "所有 AI 模型額度皆已用盡或被限制 (Limit 0)，請檢查 Google AI Studio 設定或更換帳號。"}
            return {"error": "api_error", "message": f"AI 辨識異常: {last_error[:100]}..." }

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

