import google.generativeai as genai
import sys

api_key = "AIzaSyBDIaeqHtNXkbkDuMkyTdJXDNyvO30-5N8"
genai.configure(api_key=api_key)

print(f"{'Model Name':<40} | {'Vision Support':<15}")
print("-" * 60)

try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            # Check if it supports vision
            # Most Gemini models do, but we can check the description for 'vision' or 'multimodal'
            is_vision = "vision" in m.description.lower() or "multimodal" in m.description.lower() or "image" in m.description.lower()
            print(f"{m.name:<40} | {'Yes' if is_vision else 'No'}")
except Exception as e:
    print(f"Error: {e}")
