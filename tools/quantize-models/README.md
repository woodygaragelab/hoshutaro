# tools/quantize-models — Gemma 4 E2B-it / it-assistant ダウンロード + OpenVINO 量子化

Project Mu のローカル LLM 用に、HuggingFace から Gemma 4 E2B-it と MTP drafter
（it-assistant）を取得し、OpenVINO IR 形式へ量子化するツール群。

## 配置場所

- 取得先: HuggingFace Hub（既定）または社内 S3 ミラー（`HOSHUTARO_MODEL_REGISTRY=s3-mirror`）
- 量子化後の配置: `~/.hoshutaro/models/gemma-4-e2b-it-openvino/` および
  `~/.hoshutaro/models/gemma-4-e2b-it-assistant-openvino/`

## 必要な依存

```
pip install -U huggingface_hub optimum-intel[nncf] transformers openvino
```

加えて HuggingFace ライセンス同意（Google の Gemma 利用規約）が必要:
1. <https://huggingface.co/google/gemma-4-E2B-it> でアクセスリクエスト
2. `huggingface-cli login` でトークン設定（`HUGGINGFACE_HUB_TOKEN` 環境変数でも可）

## 使い方

### コマンドラインから実行

```bash
python tools/quantize-models/download_and_quantize.py \
    --target google/gemma-4-E2B-it \
    --drafter google/gemma-4-E2B-it-assistant \
    --output-dir ~/.hoshutaro/models \
    --target-quant int4 \
    --drafter-quant int8
```

進捗は標準出力に表示。一度量子化したモデルはキャッシュされ、再実行時はスキップ。

### バックエンド経由（初回起動時自動）

`POST /api/setup/download_models` を呼ぶと、本スクリプトと同等の処理を SSE 進捗付きで実行。
詳細は `core/app/routers/setup.py` を参照。

## 量子化方式

| モデル | 量子化 | サイズ | 推論速度 |
|---|---|---|---|
| target (gemma-4-E2B-it) | INT4 (NNCF weight-only) | ~1.5GB | NPU で 30-50 tokens/sec |
| drafter (gemma-4-E2B-it-assistant) | INT8 (NNCF weight-only) | ~300MB | INT4 にすると drafter 提案精度が落ちるため INT8 |

## トラブルシューティング

- **アクセス拒否（403）**: HuggingFace でモデルアクセス申請が承認されていない。Web UI で承認状況を確認。
- **`optimum-intel` import エラー**: `pip install optimum-intel[nncf]` で nncf 依存込みインストール。
- **OpenVINO デバイス未検出**: `python -c "import openvino as ov; print(ov.Core().available_devices)"` で確認。
- **メモリ不足**: 量子化中に RAM 16GB 以上が必要。スワップ拡張または部分量子化を検討。
