# SKILLS.md自律成長 — 永続化・メトリクスパイプライン実装プラン

## 問題の概要

現在のSKILLS.md自律最適化機能は、構成関数（`skills_optimizer.py`）は存在するが、
それを駆動するパイプライン全体が欠落しており、実質的に動作しない。

```
現状:
  スキル実行 → （記録なし）→（トリガーなし）→ 何も起きない

あるべき姿:
  スキル実行 → メトリクス記録 → 蓄積・評価 → 最適化実行 → ログ保存 → reload
```

---

## 変更対象ファイル一覧

| ファイル | 操作 | 概要 |
|---------|------|------|
| `backend/app/services/metrics_collector.py` | **新規** | スキル実行ログの記録・集計・永続化 |
| `backend/app/services/persistence.py` | **新規** | thinking_depth / セッションのファイル永続化 |
| `backend/app/services/skills_optimizer.py` | **改修** | メトリクス駆動トリガー + バックアップ + ログ追加 |
| `backend/app/engine/orchestrator.py` | **改修** | メトリクス記録呼び出し + thinking_depth永続化 |
| `backend/app/services/session_manager.py` | **改修** | セッション保存/復元の永続化対応 |
| `backend/app/main.py` | **改修** | 起動時のバッチ評価 + thinking_depth読込み |
| `backend/app/config.py` | **改修** | データディレクトリ設定追加 |

---

## Phase 1: データディレクトリとファイル構造

### 1.1 ディレクトリ設計

```
backend/
  data/                          ← 新規。.gitignoreに追加
    metrics/
      metrics_store.jsonl         ← スキル実行ログ（追記）
    skills/
      optimization_log.jsonl      ← 最適化実行ログ（追記）
      skill_thinking_depth.json   ← 思考深度設定（読書き）
    sessions/
      {session_id}.json           ← セッション永続化（読書き）
  skills/
    SKILLS.md                     ← 既存。最適化対象
    SKILLS.md.bak                 ← 最適化前バックアップ（自動生成）
```

### 1.2 config.py への設定追加

```python
# 追加項目
data_dir: str = "./data"
metrics_optimization_threshold: float = 0.70    # 成功率がこの値以下で最適化トリガー
metrics_optimization_interval: int = 50         # N回実行ごとにバッチ評価
session_ttl_minutes: int = 30                   # セッション有効期限
```

---

## Phase 2: MetricsCollector（新規）

### 2.1 ファイル: `backend/app/services/metrics_collector.py`

**責務**: スキル実行結果の記録・集計・閾値判定

```python
class MetricsCollector:
    """
    スキル実行メトリクスの収集と永続化を担当する。
    jsonlファイルに追記形式で記録し、集計クエリを提供する。
    """

    def __init__(self, data_dir: str):
        self.filepath = Path(data_dir) / "metrics" / "metrics_store.jsonl"
        self.filepath.parent.mkdir(parents=True, exist_ok=True)

    def record(self, entry: MetricsEntry) -> None:
        """1件のスキル実行結果をjsonlに追記"""

    def get_skill_stats(self, skill_name: str, last_n: int = 50) -> SkillStats:
        """直近N件から成功率・平均リトライ・失敗パターンを集計"""

    def get_total_executions(self, skill_name: str) -> int:
        """累計実行回数を返す"""

    def get_failed_instructions(self, skill_name: str, last_n: int = 20) -> list[str]:
        """直近の失敗した指示テキストを返す（最適化用）"""
```

### 2.2 MetricsEntry スキーマ

```python
class MetricsEntry(BaseModel):
    timestamp: str              # ISO 8601
    session_id: str
    skill_name: str
    agent_name: str             # "EditAgent", "SchedulePlannerAgent" 等
    instruction: str            # ユーザーの元指示（プライバシー注意）
    success: bool
    retry_count: int
    thinking_iterations: int
    error_message: str = ""
    duration_ms: int = 0        # 実行時間
```

### 2.3 SkillStats スキーマ

```python
class SkillStats(BaseModel):
    skill_name: str
    total_executions: int
    success_rate: float          # 0.0〜1.0
    avg_retry: float
    failure_patterns: dict       # {"unmapped column": 5, "date format": 3, ...}
    needs_optimization: bool     # success_rate < threshold
```

---

## Phase 3: skills_optimizer.py 改修

### 3.1 追加機能

```python
class SkillsOptimizationPipeline:
    """
    メトリクス駆動のSKILLS.md最適化パイプライン。

    フロー:
    1. collect   — MetricsCollectorから統計取得
    2. evaluate  — 閾値以下のスキルを特定
    3. backup    — SKILLS.md → SKILLS.md.bak
    4. optimize  — メタLLMで改善context生成（既存のoptimize_skill関数を利用）
    5. apply     — SKILLS.md書換え + reload
    6. log       — optimization_log.jsonlに記録
    """

    async def run_batch_evaluation(self) -> list[str]:
        """
        全スキルの統計を確認し、閾値以下のスキルを最適化する。
        戻り値: 最適化されたスキル名のリスト
        """

    def _backup_skills_file(self) -> None:
        """SKILLS.md → SKILLS.md.bak にコピー"""

    def _write_optimization_log(self, entry: dict) -> None:
        """optimization_log.jsonlに追記"""

    def rollback(self) -> bool:
        """SKILLS.md.bak → SKILLS.md に復元"""
```

### 3.2 optimization_log.jsonl エントリ

```json
{
  "timestamp": "2026-03-25T14:30:00",
  "skill_name": "excel_import",
  "success_rate_before": 0.65,
  "failed_instructions_sample": ["Excelのヘッダーが2行目にある", "..."],
  "context_before_hash": "a1b2c3",
  "context_after_hash": "d4e5f6",
  "optimization_success": true
}
```

---

## Phase 4: thinking_depth 永続化（新規）

### 4.1 ファイル: `backend/app/services/persistence.py`

```python
class ThinkingDepthStore:
    """
    skill_thinking_depth.json の読み書きを担当。
    セッション跨ぎで思考深度を保持する。
    """

    def __init__(self, data_dir: str):
        self.filepath = Path(data_dir) / "skills" / "skill_thinking_depth.json"

    def load(self) -> dict[str, float]:
        """ファイルから読込み。存在しなければ空dictを返す"""

    def save(self, depth_map: dict[str, float]) -> None:
        """dictをJSONファイルに保存"""

    def update_skill(self, skill_name: str, depth: float) -> None:
        """特定スキルの深度を更新して保存"""

    def apply_time_decay(self, decay_factor: float = 0.9) -> None:
        """全スキルの深度に時間減衰を適用（サーバー起動時に呼出し）"""
```

### 4.2 時間減衰ルール（実装プランの仕様）

```
成功 & retry_count == 0 → depth = max(1, depth - 0.5)   # 徐々に戻す
retry_count >= 2        → depth = min(5, depth + 1)      # 深度増加
サーバー起動時          → depth *= 0.9                    # 時間減衰
```

---

## Phase 5: orchestrator.py 改修

### 5.1 メトリクス記録の注入ポイント

```python
async def route_and_execute(...):
    start_time = time.time()

    # ... 既存のルーティングロジック ...

    # 実行後にメトリクスを記録
    duration_ms = int((time.time() - start_time) * 1000)
    metrics_collector.record(MetricsEntry(
        timestamp=datetime.now().isoformat(),
        session_id=session_id,
        skill_name=skill_name or "generic_chat",
        agent_name=result.get("agent", "unknown"),
        instruction=instruction,
        success=not bool(final_state.get("error_message")),
        retry_count=final_state.get("thinking_iterations", 1) - 1,
        thinking_iterations=final_state.get("thinking_iterations", 1),
        error_message=final_state.get("error_message", ""),
        duration_ms=duration_ms
    ))

    # thinking_depth を永続化（メモリ + ファイル）
    thinking_depth_store.update_skill(skill_name, new_depth)

    # N回実行ごとに最適化バッチを非同期起動
    total = metrics_collector.get_total_executions(skill_name)
    if total > 0 and total % settings.metrics_optimization_interval == 0:
        asyncio.create_task(optimization_pipeline.run_batch_evaluation())
```

### 5.2 chat_history へのメタデータ記録

```python
# orchestrator実行後、session.chat_historyに記録を追加
session.chat_history.append({
    "role": "assistant",
    "content": result.get("result", ""),
    "agent": result.get("agent", ""),
    "skill": skill_name,
    "operation_type": result.get("operations", [{}])[0].get("type", "") if result.get("operations") else "",
    "timestamp": datetime.now().isoformat()
})
```

---

## Phase 6: main.py 起動時フック

### 6.1 lifespan での初期化

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 既存: LLMアダプター初期化

    # 追加1: データディレクトリ作成
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)

    # 追加2: thinking_depth 読込み + 時間減衰適用
    depth_map = thinking_depth_store.load()
    thinking_depth_store.apply_time_decay()

    # 追加3: 起動時バッチ評価（最適化チェック）
    optimized = await optimization_pipeline.run_batch_evaluation()
    if optimized:
        logger.info(f"Startup optimization: {optimized}")

    yield
```

---

## Phase 7: session_manager.py 永続化対応

### 7.1 改修内容

```python
class SessionManager:
    def __init__(self, data_dir: str = "./data"):
        self.sessions_dir = Path(data_dir) / "sessions"
        self.sessions_dir.mkdir(parents=True, exist_ok=True)

    def get_session(self, session_id: str) -> Session:
        # メモリになければファイルから復元を試みる
        if session_id not in self.sessions:
            restored = self._restore_from_disk(session_id)
            if restored:
                self.sessions[session_id] = restored
            else:
                self.sessions[session_id] = Session(session_id)
        return self.sessions[session_id]

    def save_session(self, session_id: str) -> None:
        """セッションをJSONファイルに保存"""
        # data_model, chat_history, metadata を保存
        # snapshots は最新3件のみ保存（サイズ制限）
        # import_state は保存対象（中断復帰用）

    def _restore_from_disk(self, session_id: str) -> Optional[Session]:
        """JSONファイルからセッションを復元"""

    def cleanup_expired(self, ttl_minutes: int = 30) -> int:
        """有効期限切れセッションを削除"""
```

### 7.2 保存タイミング

```
data_model更新時   → save_session() 呼出し（orchestrator / chat.py）
import_state変更時 → save_session() 呼出し（chat.py / data.py）
明示的操作時       → save_session() 呼出し（フロントエンドからのAPI）
```

---

## データフロー全体図（完成後）

```
┌─── ユーザー操作 ─────────────────────────────────────────────────────┐
│                                                                      │
│  チャット / Excel取込み / 計画生成                                      │
│       │                                                              │
│       ▼                                                              │
│  ┌─ orchestrator.py ───────────────────────────────────────────┐    │
│  │  1. skill_loader.match_skill() → スキル特定                   │    │
│  │  2. thinking_depth_store.load() → 思考深度取得                 │    │
│  │  3. サブエージェント実行                                        │    │
│  │  4. metrics_collector.record() → jsonl追記         ◄──────────┼─── 永続化①│
│  │  5. thinking_depth_store.update_skill() → json保存  ◄──────────┼─── 永続化②│
│  │  6. session.chat_history.append({agent, skill, ...})          │    │
│  │  7. session_manager.save_session() → json保存       ◄──────────┼─── 永続化③│
│  │  8. if total % 50 == 0 → asyncio.create_task(optimize)       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│       │ (50回ごと非同期)                                              │
│       ▼                                                              │
│  ┌─ SkillsOptimizationPipeline ────────────────────────────────┐    │
│  │  1. metrics_collector.get_skill_stats() → 統計取得            │    │
│  │  2. success_rate < 0.70 のスキルを特定                         │    │
│  │  3. SKILLS.md → SKILLS.md.bak                     ◄──────────┼─── 永続化④│
│  │  4. optimize_skill() → メタLLMで改善context生成                │    │
│  │  5. update_skills_file() → SKILLS.md書換え          ◄──────────┼─── 永続化⑤│
│  │  6. optimization_log.jsonl に追記                   ◄──────────┼─── 永続化⑥│
│  │  7. skill_loader.reload()                                     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─ サーバー起動時 (main.py lifespan) ─────────────────────────┐    │
│  │  1. data/ ディレクトリ作成                                     │    │
│  │  2. thinking_depth_store.load() + apply_time_decay()          │    │
│  │  3. optimization_pipeline.run_batch_evaluation()              │    │
│  │  4. session_manager.cleanup_expired()                         │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘

永続化ファイル:
  data/metrics/metrics_store.jsonl       ← ① 全スキル実行ログ
  data/skills/skill_thinking_depth.json  ← ② 思考深度（全セッション共有）
  data/sessions/{id}.json               ← ③ セッション状態
  skills/SKILLS.md.bak                  ← ④ 最適化前バックアップ
  skills/SKILLS.md                      ← ⑤ 最適化後のスキル定義
  data/skills/optimization_log.jsonl    ← ⑥ 最適化実行履歴
```

---

## 実装順序

| Step | 対象 | 依存 | 見積 |
|------|------|------|------|
| **1** | `config.py` — data_dir等の設定追加 | なし | 小 |
| **2** | `persistence.py` — ThinkingDepthStore | Step 1 | 小 |
| **3** | `metrics_collector.py` — MetricsCollector + スキーマ | Step 1 | 中 |
| **4** | `skills_optimizer.py` — Pipeline化 + backup + log | Step 3 | 中 |
| **5** | `orchestrator.py` — メトリクス記録 + depth永続化 + chat_history | Step 2,3 | 中 |
| **6** | `session_manager.py` — ファイル永続化 | Step 1 | 中 |
| **7** | `main.py` — 起動時フック | Step 2,4,6 | 小 |
| **8** | `.gitignore` — `backend/data/` 追加 | なし | 小 |

---

## .gitignore 追加

```
# AI Agent runtime data
backend/data/
```
