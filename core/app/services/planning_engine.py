import statistics
from datetime import datetime
import logging
from typing import List, Dict, Any, Optional

from app.llm import get_adapter as get_llm_adapter

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
    target_lines = []
    for line in work_order_lines:
        # 実績（◎等）だけでなく、予定（○）も考慮してスケジュールの間隔を計算する
        if line.get("Remarks") in ["実績", "済", "●", "◎", "○", "計画"] or line.get("ActualCost") or line.get("PlanScheduleStart"):
            if target_asset_id and line.get("AssetId") != target_asset_id:
                continue
            target_lines.append(line)
            
    # 日付でのソート
    dates = []
    for line in target_lines:
        # PlanScheduleStart もしくは ActualStart
        d_str = line.get("ActualStart") or line.get("PlanScheduleStart")
        if d_str:
            parsed = parse_date(d_str)
            if parsed:
                dates.append(parsed)
                
    dates.sort()
    
    if len(dates) == 1:
        # 1件しかデータがない場合、周期不明(-1)とする
        return {"intervals": [], "avg_days": -1.0, "std_dev": 0, "latest_date": dates[0].strftime("%Y-%m-%d")}
    elif len(dates) == 0:
        return {"intervals": [], "avg_days": 0, "std_dev": 0, "latest_date": None}
        
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

def _stats_fallback_text(periodicity_data: Dict[str, Any]) -> str:
    """LLM 不可時の統計ベースフォールバック（WS1-8）。LLM 未初期化で停止させない。"""
    avg = periodicity_data.get("avg_days", 0)
    latest = periodicity_data.get("latest_date")
    if not latest or not isinstance(avg, (int, float)) or avg <= 0:
        return "履歴が不足しているため次回時期を統計から推定できません。"
    try:
        latest_dt = datetime.strptime(latest, "%Y-%m-%d")
        from datetime import timedelta
        next_dt = latest_dt + timedelta(days=int(round(float(avg))))
        return (
            f"次回は {next_dt.strftime('%Y-%m')} 頃が目安です。"
            f"過去の平均間隔は約 {int(round(float(avg)))} 日で、直近実績 {latest} から推定。"
        )
    except Exception:
        return "履歴の解析に失敗したため次回時期を提案できません。"


async def generate_predictive_schedule(periodicity_data: Dict[str, Any], context: str) -> str:
    """
    周期性データとコンテキストを LLM に渡し、自然言語での予測計画・根拠説明を生成させる。
    LLM 不可時は統計ベースのフォールバック文を返す（WS1-8）。
    """
    try:
        adapter = get_llm_adapter()
    except Exception as e:
        logger.warning("LLM adapter unavailable, using stats fallback: %s", e)
        return _stats_fallback_text(periodicity_data)

    if not adapter:
        return _stats_fallback_text(periodicity_data)

    system_prompt = (
        "あなたは保全計画の専門アシスタントです。\n"
        "回答ルール:\n"
        "- 2〜3文で簡潔に答える。長い説明は不要。\n"
        "- Markdown表や箇条書きは使わない。\n"
        "- 「次回は○○頃が最適です」のように結論を先に述べる。\n"
        "- 根拠は1文で添える程度にする。"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"統計データ: {periodicity_data}\nコンテキスト: {context}\n\n次回の保全日を簡潔に提案してください。"}
    ]

    try:
        response = await adapter.chat(messages)
        if response and response.strip():
            return response
        return _stats_fallback_text(periodicity_data)
    except NotImplementedError as e:
        logger.warning("LLM not available (NotImplementedError), using stats fallback: %s", e)
        return _stats_fallback_text(periodicity_data)
    except Exception as e:
        logger.error("Prediction LLM Error: %s", e)
        # 例外時も統計フォールバックでユーザーに何かしらの提案を返す
        fallback = _stats_fallback_text(periodicity_data)
        return f"{fallback}\n（LLM 推論に失敗したため統計ベースで応答しました）"

