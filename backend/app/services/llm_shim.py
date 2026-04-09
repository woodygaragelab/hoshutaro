import json
import logging
from typing import Optional, Any
from app.services.gemini_client import gemini_client

logger = logging.getLogger(__name__)

def extract_json_object(text: str) -> Optional[dict]:
    """Extremely naive JSON object extractor."""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
    except Exception as e:
        logger.error(f"Failed to parse JSON: {e}")
    return None

def extract_json_array(text: str) -> Optional[list]:
    """Extremely naive JSON array extractor."""
    try:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            return json.loads(text[start:end+1])
    except Exception as e:
        logger.error(f"Failed to parse JSON array: {e}")
    return None

class DummyAdapter:
    """A wrapper for existing agent logic to route directly to Gemini Client."""
    
    async def chat(self, messages: list[dict]) -> str:
        prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
        return await gemini_client.generate_text(prompt)

    async def generate_structured(self, system_prompt: str, user_prompt: str, json_schema: dict = None, retries: int = 1) -> str:
        prompt = f"{user_prompt}\n\nPlease respond in valid JSON format."
        if json_schema:
            prompt += f"\nSchema: {json.dumps(json_schema)}"
        return await gemini_client.generate_text(prompt, system_instruction=system_prompt)

    async def ping(self):
        return await gemini_client.test_connection()

def get_llm_adapter(*args, **kwargs) -> DummyAdapter:
    return DummyAdapter()
