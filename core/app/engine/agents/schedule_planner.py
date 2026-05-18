import logging
from typing import Dict, Any, TypedDict, Optional
from langgraph.graph import StateGraph, START, END
from datetime import datetime, timedelta
from pydantic import BaseModel, Field

from app.services.planning_engine import analyze_periodicity, generate_predictive_schedule
from app.engine.graph import tool_execution_node
from app.services.llm_shim import get_llm_adapter
from app.services.session_manager import session_manager

logger = logging.getLogger(__name__)

class PlanningIntention(BaseModel):
    target_asset_id: str = Field(default="", description="会話の対象となっている機器のAssetId（例: P-101）。会話履歴から特定できる場合は必ず含める。")
    specified_days: Optional[int] = Field(default=None, description="ユーザーが指定した周期（日単位。1年なら365、半年なら180など）。指定がなければNone")

class PlannerState(TypedDict):
    session_id: str
    messages: list[dict]
    data_context: dict
    instruction: str
    target_asset_id: str
    user_specified_days: Optional[int]
    extracted_history: list[dict]
    stats_data: dict
    prediction_text: str
    operations: list[dict]
    final_response: str
    retry_count: int          # ReActリトライ回数（最大3）
    error_message: str        # tools実行エラーのフィードバック

async def extract_history_node(state: PlannerState) -> Dict[str, Any]:
    """
    対象Assetの過去履歴を抽出する（LLMを用いて文脈から抽出）
    """
    logger.info("Planner: Extracting history")
    data_ctx = state.get("data_context", {})
    wol_lines = data_ctx.get("workOrderLines", [])
    
    inst = state.get("instruction", "")
    messages = state.get("messages", [])
    
    target_id = ""
    user_specified_days = None

    adapter = get_llm_adapter(wait_timeout=2.0)
    if adapter:
        recent_text = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages[-4:]])
        # データ内の機器IDリストをLLMに提供してマッチ精度を上げる
        known_assets = list(set(line.get("AssetId", "") for line in wol_lines if line.get("AssetId")))
        assets_hint = f"データ内の機器ID一覧: {', '.join(sorted(known_assets)[:20])}" if known_assets else ""

        extraction_prompt = (
            f"以下の会話履歴と最新の指示から、対象機器のIDと、ユーザーが指定したスケジュール周期(日単位)があれば抽出してください。\n"
            f"{assets_hint}\n\n"
            f"会話履歴:\n{recent_text}\n\n最新の指示:\n{inst}\n\n"
            f"JSON形式で回答してください:\n"
            f'{{"target_asset_id": "機器ID or 空文字", "specified_days": 日数 or null}}'
        )
        try:
            raw_result = await adapter.classify_intent(
                [{"role": "user", "content": extraction_prompt}],
                "あなたは保全管理データから情報を抽出するアシスタントです。指定されたJSON形式でのみ回答してください。"
            )
            # classify_intent は dict を返す（JSON解析済み）
            target_id = raw_result.get("target_asset_id", "") or ""
            days_val = raw_result.get("specified_days")
            if days_val is not None:
                try:
                    user_specified_days = int(days_val)
                except (ValueError, TypeError):
                    user_specified_days = None
        except Exception as e:
            logger.error(f"Planning Intention Extraction Error: {e}")

    # Fallback: テキストマッチ
    if not target_id:
        for line in wol_lines:
            asset_id = line.get("AssetId", "")
            if asset_id and asset_id in inst:
                target_id = asset_id
                break

    # 明確化パス: target_asset_id が特定できない場合
    if not target_id:
        unique_assets = list(set(
            line.get("AssetId", "") for line in wol_lines if line.get("AssetId")
        ))
        if len(unique_assets) > 1:
            sorted_assets = sorted(unique_assets)
            # 簡潔に: 5件以下ならそのまま、多ければ代表例+残件数
            if len(sorted_assets) <= 5:
                asset_list = "、".join(sorted_assets)
            else:
                asset_list = "、".join(sorted_assets[:5]) + f" など全{len(sorted_assets)}件"
            return {
                "target_asset_id": "",
                "user_specified_days": user_specified_days,
                "extracted_history": wol_lines,
                "final_response": f"どの機器の保全計画を作成しますか？（{asset_list}）",
                "operations": [],
            }
        elif len(unique_assets) == 1:
            target_id = unique_assets[0]  # 1件なら自動選択

    return {"target_asset_id": target_id, "user_specified_days": user_specified_days, "extracted_history": wol_lines}

async def analyze_stats_node(state: PlannerState) -> Dict[str, Any]:
    """過去履歴の周期性を分析する"""
    logger.info("Planner: Analyzing stats")
    lines = state.get("extracted_history", [])
    target_id = state.get("target_asset_id")
    
    stats = analyze_periodicity(lines, target_id)
    
    # ユーザーが明示的に日数を指定していれば、計算された周期より優先する
    specified_days = state.get("user_specified_days")
    if specified_days is not None and specified_days > 0:
        stats["avg_days"] = float(specified_days)
        
    return {"stats_data": stats}

async def generate_prediction_node(state: PlannerState) -> Dict[str, Any]:
    """LLMを用いて予測結果を自然言語で説明する"""
    logger.info("Planner: Generating LLM prediction")
    stats = state.get("stats_data", {})
    inst = state.get("instruction", "")
    
    # 予測テキスト生成
    pred_text = await generate_predictive_schedule(stats, inst)
    
    return {"prediction_text": pred_text, "final_response": pred_text}

async def propose_operation_node(state: PlannerState) -> Dict[str, Any]:
    """
    予測された日付を基に次回保全計画(DataModel操作)を提案する。

    初回実行時: 提案テキストを返しユーザー確認を待つ（opsをセッションに保留）
    確認済み再実行時: 保留opsをそのまま返してtools実行へ進む
    """
    logger.info("Planner: Proposing operation")
    stats = state.get("stats_data", {})
    target_id = state.get("target_asset_id") or "ASSET-UNKNOWN"
    session_id = state.get("session_id", "")

    avg_days = stats.get("avg_days", 0)
    latest = stats.get("latest_date")
    ops = []

    if avg_days > 0 and latest:
        try:
            latest_dt = datetime.strptime(latest, "%Y-%m-%d")
            next_dt = latest_dt + timedelta(days=int(avg_days))
            next_dt_str = next_dt.strftime("%Y-%m-%d")

            ops.append({
                "type": "create_work_order_line",
                "targets": [{
                    "entity_type": "workOrderLine",
                    "entity_id": f"WOL-PREDICT-{int(datetime.now().timestamp())}",
                    "changes": {
                        "AssetId": target_id,
                        "WorkOrderName": "次回スケジュール",
                        "PlanScheduleStart": next_dt_str,
                        "Planned": True,
                        "Remarks": "統計または指定に基づく自動生成"
                    }
                }],
                "action_summary": f"{target_id} の次回保全 ({next_dt_str}) をスケジュールしました。"
            })
        except Exception as e:
            logger.error(f"Prediction logic error: {e}")

    summary = state.get("final_response", "")

    if ops:
        # ── ユーザー確認フロー ──
        # セッションに保留opsを保存し、確認質問を返す（操作はまだ実行しない）
        session = session_manager.get_session(session_id) if session_id else None
        if session:
            # 確認済みの再実行（pending_schedule_ops が空 = 既にクリア済み = 今回はtools実行OK）
            pending = session.metadata.get("pending_schedule_ops")
            if pending:
                # ユーザーが確認済み → 保留opsを実行に回す
                logger.info("Planner: User confirmed — executing pending ops")
                session.metadata.pop("pending_schedule_ops", None)
                return {"operations": pending, "final_response": summary}

            # 初回提案 → opsをセッションに保留し、確認質問を返す
            session.metadata["pending_schedule_ops"] = ops
            next_dt_str = ops[0]["targets"][0]["changes"]["PlanScheduleStart"]
            avg_days_val = int(stats.get("avg_days", 0))
            confirmation_text = (
                f"{target_id} の保全間隔は平均{avg_days_val}日です。"
                f"次回を {next_dt_str} にスケジュールしてよろしいですか？"
            )
            logger.info("Planner: Proposal stored, waiting for user confirmation")
            return {"operations": [], "final_response": confirmation_text}

        # セッション取得できない場合は従来通り即実行
        summary += f"\n\n[自動提案] {ops[0]['action_summary']}"
        return {"operations": ops, "final_response": summary}

    elif avg_days < 0 and latest:
        summary = f"{target_id} の実績データが1件しかないため、次回の計画周期が計算できません。次回の計画はいつ（何年後、半年後など）に設定しますか？"
    elif not latest:
        summary = f"{target_id} に関する過去の保全実績や予定が全く見つかりません。新規作成として、次回の予定日をいつ（何日後など）に設定しますか？"

    return {"operations": [], "final_response": summary}

async def evaluate_tools_result_node(state: PlannerState) -> Dict[str, Any]:
    """
    ReAct Observe & Evaluate: tools実行結果を検証する。
    成功 → final_responseに反映。失敗 → error_messageにフィードバックしretry_countを加算。
    """
    logger.info("Planner: Evaluating tools result")
    final_res = state.get("final_response", "")
    retry_count = state.get("retry_count", 0)

    # tool_execution_node は final_response に "(N件適用)" を付加する
    # 適用件数が0 = 全操作失敗
    has_success = "件適用" in final_res and "0件適用" not in final_res

    if has_success:
        # 成功: エラーをクリアして終了へ
        return {"error_message": ""}
    else:
        # 失敗: エラーフィードバックして再推論へ
        error_msg = f"操作の適用に失敗しました（リトライ {retry_count + 1}/3）。予測日の再計算を試みます。"
        logger.warning("Planner tools failed, retry %d/3", retry_count + 1)
        return {
            "error_message": error_msg,
            "retry_count": retry_count + 1,
            "operations": [],  # 失敗したopsをクリア
        }


def should_skip_after_extract(state: PlannerState) -> str:
    """target_asset_idが空で明確化質問がセットされていれば終了"""
    if not state.get("target_asset_id") and state.get("final_response"):
        return END
    return "analyze"

def should_execute_tools(state: PlannerState) -> str:
    if state.get("operations") and len(state["operations"]) > 0:
        return "tools"
    return END

def should_retry_after_evaluate(state: PlannerState) -> str:
    """
    ReAct Evaluate判定: 成功なら終了、失敗かつリトライ上限未達ならpredictに戻る。
    """
    error = state.get("error_message", "")
    retry_count = state.get("retry_count", 0)

    if not error:
        # 成功
        return END
    if retry_count >= 3:
        # リトライ上限 → エラーメッセージを残して終了
        logger.error("Planner: Max retries reached (3), giving up")
        return END
    # リトライ: predict → propose → tools → evaluate のループ
    return "predict"

def create_schedule_planner_graph():
    workflow = StateGraph(PlannerState)

    workflow.add_node("extract", extract_history_node)
    workflow.add_node("analyze", analyze_stats_node)
    workflow.add_node("predict", generate_prediction_node)
    workflow.add_node("propose", propose_operation_node)

    # graph.py と同じインターフェースのノードを流用 (PlannerStateもdictとしては互換)
    workflow.add_node("tools", tool_execution_node)
    workflow.add_node("evaluate", evaluate_tools_result_node)

    workflow.add_edge(START, "extract")

    # extract → [target_id?] → analyze or END (clarification)
    workflow.add_conditional_edges(
        "extract",
        should_skip_after_extract,
        {
            "analyze": "analyze",
            END: END
        }
    )

    workflow.add_edge("analyze", "predict")
    workflow.add_edge("predict", "propose")

    workflow.add_conditional_edges(
        "propose",
        should_execute_tools,
        {
            "tools": "tools",
            END: END
        }
    )

    # tools → evaluate（結果検証）
    workflow.add_edge("tools", "evaluate")

    # evaluate → [成功?END / 失敗かつリトライ上限未達?predict / 上限到達?END]
    # ReActループ: predict → propose → tools → evaluate → predict (最大3回)
    workflow.add_conditional_edges(
        "evaluate",
        should_retry_after_evaluate,
        {
            END: END,
            "predict": "predict",
        }
    )

    return workflow.compile()

schedule_planner_engine = create_schedule_planner_graph()

