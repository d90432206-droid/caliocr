import google.generativeai as genai
import sys

api_key = "AIzaSyBDIaeqHtNXkbkDuMkyTdJXDNyvO30-5N8"
genai.configure(api_key=api_key)

try:
    print("Listing available models for the current API Key:")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error: {e}")
