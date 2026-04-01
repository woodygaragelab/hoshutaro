import json
import logging
import re

logger = logging.getLogger(__name__)

class ParseError(ValueError):
    """JSON 抽出・パースに失敗した場合に raise される。"""
    def __init__(self, message: str, raw: str):
        super().__init__(message)
        self.raw = raw

def extract_json_object(text: str) -> dict:
    """
    LLM の出力テキストから JSON オブジェクトを抽出してパースする。
    """
    original = text
    text = text.strip()

    # 1. ```json ... ``` ブロック
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 2. ``` ... ``` ブロック
    m = re.search(r"```\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 3. 最初の { ... } ブロックを探す
    start = text.find("{")
    if start != -1:
        depth = 0
        in_string = False
        escape = False
        for i, ch in enumerate(text[start:], start=start):
            if escape:
                escape = False
                continue
            if ch == "\\" and in_string:
                escape = True
                continue
            if ch == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break

    # 4. ベースパース
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    raise ParseError(f"JSON抽出失敗: {repr(original[:120])}", raw=original)


def extract_json_array(text: str) -> list:
    """
    LLM の出力テキストから JSON 配列を抽出してパースする。
    """
    original = text
    text = text.strip()

    # 1. ```json ... ``` ブロック
    m = re.search(r"```json\s*(\[.*?\])\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 2. ``` ... ``` ブロック
    m = re.search(r"```\s*(\[.*?\])\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass

    # 3. 最初の [ ... ] ブロックを探す
    start = text.find("[")
    if start != -1:
        depth = 0
        in_string = False
        escape = False
        for i, ch in enumerate(text[start:], start=start):
            if escape:
                escape = False
                continue
            if ch == "\\" and in_string:
                escape = True
                continue
            if ch == '"' and not escape:
                in_string = not in_string
                continue
            if in_string:
                continue
            if ch == "[":
                depth += 1
            elif ch == "]":
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break

    # 4. ベースパース
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    raise ParseError(f"JSON配列抽出失敗: {repr(original[:120])}", raw=original)
