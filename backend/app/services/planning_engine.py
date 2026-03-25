import statistics
from datetime import datetime, timedelta
import logging
from typing import List, Dict, Any, Optional

from app.llm.factory import get_llm_adapter

logger = logging.getLogger(__name__)

def parse_date(date_str: str) -> Optional[datetime]:
    """Y-m-d形式などの日付文字列をパースする"""
    try:
        # T以降の時刻をざっくり切るなど
        clean_str = date_str.split('T')[0]
        return datetime.strptime(clean_str, "%Y-%m-%d")
    except ValueError:
        return None

def analyze_periodicity(work_order_lines: List[Dict[str, Any]], target_asset_id: str = None) -> Dict[str, Any]:
    """
    指定された条件（特定のAssetや全体の傾向）の完了済み履歴から、
    点検の間隔(日数)の平均・標準偏差を計算する。
    """
    # 対象の抽出 (完了済みのもの)
    target_lines = []
    for line in work_order_lines:
        if line.get("ActualCost") or line.get("Remarks") in ["実績", "済", "●", "◎"]:
            if target_asset_id and line.get("AssetId") != target_asset_id:
                continue
            target_lines.append(line)
            
    # 日付でのソート
    dates = []
    for line in target_lines:
        start_date = line.get("PlanScheduleStart")
        if start_date:
            parsed = parse_date(start_date)
            if parsed:
                dates.append(parsed)
                
    dates.sort()
    
    if len(dates) < 2:
        return {"intervals": [], "avg_days": 0, "std_dev": 0, "latest_date": dates[-1].strftime("%Y-%m-%d") if dates else None}
        
    intervals = []
    for i in range(1, len(dates)):
        diff = (dates[i] - dates[i-1]).days
        if diff > 0:  # 同日の重複等は無視
            intervals.append(diff)
            
    if not intervals:
        return {"intervals": [], "avg_days": 0, "std_dev": 0, "latest_date": dates[-1].strftime("%Y-%m-%d")}
        
    avg_days = statistics.mean(intervals)
    std_dev = statistics.stdev(intervals) if len(intervals) >= 2 else 0.0
    
    return {
        "intervals": intervals,
        "avg_days": avg_days,
        "std_dev": std_dev,
        "latest_date": dates[-1].strftime("%Y-%m-%d")
    }

async def generate_predictive_schedule(periodicity_data: Dict[str, Any], context: str) -> str:
    """
    周期性データとコンテキストをLLMに渡し、自然言語での予測計画・根拠説明を生成させる。
    """
    adapter = get_llm_adapter()
    if not adapter:
        return "LLMが初期化されていません。"
        
    system_prompt = (
        "あなたは保全計画の専門アシスタントです。"
        "提供された統計データ（平均間隔、標準偏差、最終実施日）をもとに、"
        "次回の最適な保全日とその根拠を推論し、自然言語で短く的確に説明してください。"
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"【コンテキスト】\n{context}\n\n【統計データ】\n{periodicity_data}\n\n今後の保全計画を提案してください。"}
    ]
    
    try:
        response = await adapter.chat(messages)
        return response
    except Exception as e:
        logger.error(f"Prediction LLM Error: {e}")
        return f"予測の生成中にエラーが生じました: {str(e)}"
