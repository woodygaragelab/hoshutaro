"""
Project Mu サブシステムのスモークテスト（依存最小、ローカル DB のみ）。

実行: python -m pytest core/tests/test_mu_smoke.py -v
あるいは python -c で直接スクリプト実行（pytest なしでも動く）

確認内容:
  - memory CRUD（rules / master_map / training_cache / lora_adapters / prompt_cache）
  - sql_context_resolver の解決（ベクトル無し環境でも動作）
  - learning/adapter_manager のバージョン管理
  - learning/training_scheduler の閾値判定
  - routers/mu.py の dashboard エンドポイント（FastAPI TestClient）
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path


def _setup_isolated_db() -> tempfile.TemporaryDirectory:
    """各テストで使う独立 SQLite DB の準備。"""
    tmpdir = tempfile.mkdtemp(prefix="mu_smoke_")
    os.environ["SQLITE_PATH"] = str(Path(tmpdir) / "test.db")
    os.environ["KASE_KV_CACHE_DIR"] = str(Path(tmpdir) / "llm_cache")
    os.environ["HOSHUTARO_LORA_DIR"] = str(Path(tmpdir) / "lora")
    return tmpdir


def test_memory_crud_full_cycle():
    tmpdir = _setup_isolated_db()
    try:
        from app.mu.memory import db
        db.reset_for_tests()
        from app.mu.memory import (
            rules,
            master_map,
            training_cache,
            lora_adapters,
            prompt_cache,
        )

        # rules
        rid = rules.create(
            task_type="id_normalization",
            regex_pattern=r"^EQ\d+$",
            instruction_text="EQ + 数字に正規化",
            organization="org-a",
            examples=["EQ001"],
            confidence=0.9,
        )
        assert rid > 0
        r = rules.get(rid)
        assert r is not None
        assert r.task_type == "id_normalization"
        assert r.examples == ["EQ001"]

        # master_map
        mid = master_map.create(
            raw_name="P-101 Pump",
            standard_name="Pump",
            category_id="PUMP",
            location_path="A/3F",
            user_confirmed=True,
            confidence=0.95,
            organization="org-a",
        )
        assert mid > 0
        found = master_map.find_by_raw_name("P-101 Pump", organization="org-a")
        assert len(found) == 1
        assert found[0].standard_name == "Pump"

        # training_cache
        tcid = training_cache.add(
            task_type="enrichment_classification_location",
            input_text='{"raw_name":"P-101"}',
            output_json='{"category_id":"PUMP"}',
            user_confirmed=True,
            organization="org-a",
        )
        assert tcid > 0
        assert training_cache.count_unused(organization="org-a") == 1

        # lora_adapters
        lora_adapters.register(
            version="v-test-1",
            file_path="/tmp/v1.safetensors",
            base_model="google/gemma-4-E2B-it",
            task_types=["id_normalization"],
            training_examples_count=1,
            metrics={"accuracy": 0.9},
            organization="org-a",
            activate=True,
        )
        active = lora_adapters.get_active(organization="org-a")
        assert active is not None
        assert active.version == "v-test-1"

        # prompt_cache
        rules_hash = prompt_cache.compute_rules_hash([str(rid)])
        prompt_cache.upsert(
            cache_key="test_cache_v1",
            file_path="/tmp/cache.bin",
            model_id="local_gemma_4_e2b_it",
            rules_hash=rules_hash,
            lora_version="v-test-1",
        )
        valid = prompt_cache.is_valid(
            "test_cache_v1",
            expected_rules_hash=rules_hash,
            expected_model_id="local_gemma_4_e2b_it",
            expected_lora_version="v-test-1",
        )
        assert valid is True
        invalid = prompt_cache.is_valid(
            "test_cache_v1",
            expected_rules_hash="DIFFERENT",
            expected_model_id="local_gemma_4_e2b_it",
            expected_lora_version="v-test-1",
        )
        assert invalid is False

        print("OK: memory CRUD full cycle")
    finally:
        from app.mu.memory.db import close_connection
        close_connection()


def test_sql_context_resolver_without_vectors():
    tmpdir = _setup_isolated_db()
    try:
        from app.mu.memory import db
        db.reset_for_tests()
        from app.mu.memory import rules, master_map
        from app.skills.sql_context_resolver import resolve_sql_context

        # 事前データ
        rules.create(
            task_type="id_normalization",
            regex_pattern=r"^EQ\d+$",
            instruction_text="EQ正規化",
            organization="org-a",
            confidence=0.8,
        )
        master_map.create(
            raw_name="P-101",
            standard_name="Pump",
            category_id="PUMP",
            location_path="A/3F",
            user_confirmed=True,
            organization="org-a",
        )

        # sql_context spec を resolve
        spec = [
            {
                "source": "rules",
                "filter": {
                    "task_type": "id_normalization",
                    "organization": "$current_org",
                    "active": 1,
                },
                "order_by": "success_count DESC",
                "limit": 10,
                "template": "rules_for_prompt",
            },
            {
                "source": "master_map",
                "filter": {
                    "organization": "$current_org",
                    "user_confirmed": 1,
                },
                "limit": 5,
            },
        ]
        ctx = resolve_sql_context(spec, runtime_vars={"current_org": "org-a"})
        assert "rules" in ctx.entries
        assert "master_map" in ctx.entries
        assert "EQ正規化" in ctx.entries["rules"]
        assert "Pump" in ctx.entries["master_map"]
        # ベクトル拡張無しの環境ではスキップで無害
        assert len(ctx.used_rule_ids) >= 1
        assert len(ctx.used_mapping_ids) >= 1

        print("OK: sql_context_resolver (no vectors)")
    finally:
        from app.mu.memory.db import close_connection
        close_connection()


def test_training_scheduler_threshold():
    tmpdir = _setup_isolated_db()
    try:
        from app.mu.memory import db
        db.reset_for_tests()
        from app.mu.memory import training_cache as tc
        from app.mu.learning.training_scheduler import TrainingScheduler, reset_for_tests

        # 閾値 5 でスケジューラ作成
        sched = TrainingScheduler(threshold=5)
        reset_for_tests(sched)

        # 5 件未満は trigger しない
        for _ in range(3):
            tc.add(
                task_type="t1",
                input_text="i",
                output_json="o",
                user_confirmed=True,
                organization="org-a",
            )
        assert sched.should_trigger(organization="org-a") is False

        # 5 件超えで trigger 可能
        for _ in range(3):
            tc.add(
                task_type="t1",
                input_text="i",
                output_json="o",
                user_confirmed=True,
                organization="org-a",
            )
        assert sched.should_trigger(organization="org-a") is True
        assert sched.pending_count(organization="org-a") == 6

        print("OK: training_scheduler threshold")
    finally:
        from app.mu.memory.db import close_connection
        close_connection()


def test_lora_trainer_graceful_degradation():
    """学習スタック未インストール時に train_lora() が NotImplementedError を投げる。

    依存（torch/transformers/peft/datasets）が揃った環境ではスキップ
    （実モデル DL を CI で発生させないため）。
    """
    tmpdir = _setup_isolated_db()
    try:
        from app.mu.memory import db
        db.reset_for_tests()
        from app.mu.learning import lora_trainer

        stack = lora_trainer._load_training_stack()
        if "error" not in stack:
            print("SKIP: training stack installed (would attempt real training)")
            return

        async def run() -> str:
            try:
                await lora_trainer.train_lora()
            except NotImplementedError as e:
                return str(e)
            return ""

        msg = asyncio.run(run())
        assert msg, "expected NotImplementedError when training deps are missing"
        assert "Training deps not installed" in msg, f"unexpected message: {msg}"
        print("OK: lora_trainer graceful degradation")
    finally:
        from app.mu.memory.db import close_connection
        close_connection()


def test_dashboard_endpoint():
    tmpdir = _setup_isolated_db()
    try:
        from app.mu.memory import db
        db.reset_for_tests()
        from app.mu.memory import rules
        from app.routers.mu import router

        # テスト用 FastAPI app に router を組み込み
        from fastapi import FastAPI
        from fastapi.testclient import TestClient

        app = FastAPI()
        app.include_router(router)

        rules.create(
            task_type="id_normalization",
            instruction_text="test",
            organization="org-a",
        )

        client = TestClient(app)
        resp = client.get("/api/mu/dashboard?organization=org-a")
        assert resp.status_code == 200
        body = resp.json()
        assert body["rules"]["total"] >= 1
        assert "training_cache" in body
        assert "lora" in body

        # health
        health_resp = client.get("/api/mu/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["ok"] is True

        # rules CRUD via API
        create_resp = client.post(
            "/api/mu/rules",
            json={
                "task_type": "header_pattern",
                "instruction_text": "ヘッダー位置を判定",
                "organization": "org-a",
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        new_rule = create_resp.json()
        assert new_rule["task_type"] == "header_pattern"

        list_resp = client.get("/api/mu/rules?organization=org-a")
        assert list_resp.status_code == 200
        assert any(r["task_type"] == "header_pattern" for r in list_resp.json())

        print("OK: dashboard endpoint + rules CRUD via API")
    finally:
        from app.mu.memory.db import close_connection
        close_connection()


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    failed = 0
    for fn in (
        test_memory_crud_full_cycle,
        test_sql_context_resolver_without_vectors,
        test_training_scheduler_threshold,
        test_lora_trainer_graceful_degradation,
        test_dashboard_endpoint,
    ):
        try:
            fn()
        except AssertionError as e:
            print(f"FAIL: {fn.__name__}: {e}")
            failed += 1
        except Exception as e:
            import traceback

            print(f"ERROR: {fn.__name__}: {e}")
            traceback.print_exc()
            failed += 1
    if failed == 0:
        print("\n=== All Mu smoke tests passed ===")
    else:
        print(f"\n=== {failed} test(s) failed ===")
        sys.exit(1)
