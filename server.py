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

# API Key 池 (輪替使用以增加總額度)
api_keys = [
    "AIzaSyBDIaeqHtNXkbkDuMkyTdJXDNyvO30-5N8",
    "AIzaSyCdah2jZhtA1y0Pk4r8BtGOHBwAim2KEVI",
    "AIzaSyAc598l6q8lQNUrXBJqaTSQQkk8qDyMKtk"
]

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
        
        if "," in request.image_base64:
            encoded = request.image_base64.split(",", 1)[1]
        else:
            encoded = request.image_base64
        
        image_bytes = base64.b64decode(encoded)
        
        # 根據您的權限清單，僅嘗試這四種模型
        models_to_try = [
            'gemini-2.5-flash',
            'gemini-2.5-flash-lite',
            'gemini-2.5-flash-tts',
            'gemini-3-flash'
        ]
        
        last_error = ""
        success_text = None

        # 兩層式輪替：外層換 Key，內層換模型
        for current_key in api_keys:
            try:
                print(f"Trying Key (first 4): {current_key[:4]}..."); sys.stdout.flush()
                genai.configure(api_key=current_key)
                
                for model_name in models_to_try:
                    try:
                        print(f"  > Attempting model: {model_name}"); sys.stdout.flush()
                        model = genai.GenerativeModel(model_name)
                        
                        if request.mode == 'identity':
                            prompt = "Identify device nameplate: brand (maker), model (model), serial number (serial_number). Return JSON: {\"maker\": \"...\", \"model\": \"...\", \"serial_number\": \"...\"}. No markdown."
                        else:
                            prompt = f"Identify value and unit for this {request.type} instrument. Return JSON: " + "{\"value\": \"...\", \"unit\": \"...\"}. No markdown."

                        response = model.generate_content([
                            prompt,
                            {"mime_type": "image/jpeg", "data": image_bytes}
                        ])
                        
                        success_text = response.text.strip()
                        print(f"  [SUCCESS] Model {model_name} with Key {current_key[:4]}!"); sys.stdout.flush()
                        break 
                    except Exception as mod_err:
                        last_error = str(mod_err)
                        print(f"  [FAIL] Model {model_name}: {last_error[:50]}..."); sys.stdout.flush()
                        continue
                
                if success_text:
                    break # 已拿到結果，跳出 Key 輪替
            except Exception as key_err:
                print(f"Key Error: {str(key_err)[:50]}"); sys.stdout.flush()
                continue

        if not success_text:
            print(f"All keys and models failed. Last error: {last_error}"); sys.stdout.flush()
            return {"error": "quota_exceeded", "message": "三組 API Key 的額度皆已用盡，請明天再試或更換更多 Key。"}

        text = success_text

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

