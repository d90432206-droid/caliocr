import google.generativeai as genai
import sys
import io

# Force stdout to use UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

api_key = "AIzaSyBDIaeqHtNXkbkDuMkyTdJXDNyvO30-5N8"
genai.configure(api_key=api_key)

print(f"{'Model Name':<40} | {'Vision Support':<15}")
print("-" * 60)

try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            description = m.description.lower()
            is_vision = any(kw in description for kw in ["vision", "multimodal", "image", "visual"])
            print(f"{m.name:<40} | {'Yes' if is_vision else 'No'}")
except Exception as e:
    print(f"Error: {e}")
