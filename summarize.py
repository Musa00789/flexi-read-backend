from flask import Flask, request, jsonify
import os, uuid
from dotenv import load_dotenv
from google import genai
from transformers import pipeline

# ─── setup ───
load_dotenv()
api_key = os.getenv("GEMENI_API_KEY")            
if not api_key:
    raise RuntimeError("GENAI_API_KEY not set in environment")

client = genai.Client(api_key=api_key)
summarizer = pipeline("summarization")

app = Flask(__name__)                          

# ─── summarize endpoint ───
@app.route("/summarize", methods=["POST"])
def summarize():
    text = request.json.get("text", "")
    if not text:
        return jsonify({"error": "No text provided"}), 400
    summary = summarizer(text, max_length=130, min_length=30, do_sample=False)
    return jsonify({"summary": summary[0]['summary_text']})

# ─── stateful chat endpoint ───
# for Python 3.9+ you can keep dict[str, …]; otherwise use typing.Dict
sessions: dict[str, genai.chats.Chat] = {}

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_msg = data.get("message")
    if not user_msg:
        return jsonify({"error": "No message provided"}), 400

    sid = data.get("session_id")
    if sid and sid in sessions:
        chat = sessions[sid]
    else:
        chat = client.chats.create(model="gemini-2.0-flash-001")
        sid = str(uuid.uuid4())
        sessions[sid] = chat

    response = chat.send_message(message=user_msg)
    return jsonify({"session_id": sid, "reply": response.text})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
