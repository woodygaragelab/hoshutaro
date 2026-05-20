"""
JSON 抽出ユーティリティ（旧 llm_shim から移設、プラン WS1-5）。

LLM 出力からの JSON オブジェクト/配列抽出に使用。前置きや説明、コードブロックを含む
出力にも対応する「最初の { から最後の } まで」「最初の [ から最後の ] まで」のナイーブ抽出。
"""

from __future__ import annotations

import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def extract_json_object(text: str) -> Optional[dict]:
    """テキストから最初の JSON オブジェクトを抽出（最初の { から最後の } まで）。"""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
    except Exception as e:
        logger.error("Failed to parse JSON object: %s", e)
    return None


def extract_json_array(text: str) -> Optional[list]:
    """テキストから最初の JSON 配列を抽出（最初の [ から最後の ] まで）。"""
    try:
        start = text.find("[")
        end = text.rfind("]")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
    except Exception as e:
        logger.error("Failed to parse JSON array: %s", e)
    return None
