import json
import os
import urllib.error
import urllib.request
from typing import Any

from .env import load_local_env


OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"


def request_openai_json(
    *,
    schema: dict[str, Any],
    schema_name: str,
    system_prompt: str,
    user_content: str,
    timeout_seconds: int = 20,
) -> dict[str, Any] | None:
    load_local_env()
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        return None

    payload = {
        "messages": [
            {"content": system_prompt, "role": "system"},
            {"content": user_content, "role": "user"},
        ],
        "model": os.getenv("OPENAI_CHAT_MODEL") or "gpt-4o-mini",
        "response_format": {
            "json_schema": {
                "name": schema_name,
                "schema": schema,
                "strict": True,
            },
            "type": "json_schema",
        },
    }
    request = urllib.request.Request(
        OPENAI_CHAT_COMPLETIONS_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            data = json.loads(response.read().decode("utf-8"))

        content = data.get("choices", [{}])[0].get("message", {}).get("content")
        if not isinstance(content, str) or not content.strip():
            return None

        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except (
        KeyError,
        ValueError,
        TimeoutError,
        urllib.error.URLError,
        urllib.error.HTTPError,
    ):
        return None
