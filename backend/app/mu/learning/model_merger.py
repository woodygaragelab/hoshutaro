"""
ベースモデル + LoRA → OpenVINO IR マージ（スタブ）。

実装方針（Track B 終了後）:
  オプション1: PEFT で base + LoRA を merge_and_unload して PyTorch state_dict を生成
              → optimum-intel で OpenVINO IR に変換 → Tauri リソースに配置
  オプション2: OpenVINO Runtime の動的 LoRA 適用機能（近年の OpenVINO ≥ 2024.4）
              → マージ不要、起動時に LoRA アダプターを別ファイルとして指定

選定基準:
  - オプション2 の方がマージコスト不要・LoRA 切替容易だが、OpenVINO バージョン依存
  - オプション1 はマージ時間がかかるが推論時の負荷増なし
  - 着手時点の OpenVINO 最新バージョンで両方検証してから決定
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def merge_lora_into_openvino(
    *,
    base_model_dir: Path,
    lora_safetensors_path: Path,
    output_dir: Path,
) -> Path:
    """
    base + LoRA を OpenVINO IR にマージして output_dir に保存。

    現状: 未実装スタブ。NotImplementedError を投げる。
    """
    raise NotImplementedError(
        "merge_lora_into_openvino is not implemented yet. "
        "Choose between (1) PEFT merge_and_unload → optimum-intel OV conversion, "
        "or (2) OpenVINO Runtime dynamic LoRA adapter (≥2024.4)."
    )


def supports_dynamic_lora() -> bool:
    """
    OpenVINO Runtime が動的 LoRA 適用に対応しているか。

    現状: False を返す（Track B で実装時に判定ロジックを差し込む）。
    """
    try:
        import openvino  # type: ignore
    except ImportError:
        return False
    # version 判定はインストール後に追加
    return False
