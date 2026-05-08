# tools/bench-mu — Track B 実機検証 harness

Project Mu の **OpenVINO + Gemma 4 E2B-it (target) + it-assistant (MTP drafter)**
推論経路を実機で検証するための CLI / テスト群。

開発環境（GPU/NPU 無しの CI / クラウドコンテナ）では **graceful に
NotImplementedError を返す** ため、ここに置いておけば誰の手元でも安全に走らせられる。
実機 (Intel Arc GPU 推奨 / NPU 可) で動かして初めて推論メトリクスが測れる。

## 構成

```
tools/bench-mu/
├── README.md                      # 本ファイル
├── check_setup.py                 # 事前確認 (deps / models / device / HF token)
├── run_inference_bench.py         # 推論ベンチ本体 (latency / tokens-per-sec / MTP speedup)
└── prompts/
    └── benchmark_set.jsonl        # 8 prompt の代表セット（phase1/2/3 + 対話 short/med/long）

backend/tests/
├── test_openvino_adapter_helpers.py  # 純関数 unit test (no deps required)
└── test_downloader_mock.py            # ModelSetupManager の mock 駆動 integration test
```

## 使い方

### 1. 事前確認

```bash
python tools/bench-mu/check_setup.py
```

依存ライブラリ・モデルファイル・OpenVINO デバイス・HF トークン・ディスク空きをまとめて確認。
失敗があれば `next_action` で具体的な解消コマンドを表示。

CI 用 (blocker があれば exit 1):

```bash
python tools/bench-mu/check_setup.py --strict --json
```

### 2. モデル取得 + 量子化（初回のみ）

```bash
export HUGGINGFACE_HUB_TOKEN=hf_...
python tools/quantize-models/download_and_quantize.py \
    --target google/gemma-4-E2B-it \
    --drafter google/gemma-4-E2B-it-assistant \
    --output-dir ~/.hoshutaro/models \
    --target-quant int4 --drafter-quant int8
```

(本リポにはこのスクリプトを呼ぶ FastAPI ルート `POST /api/setup/download_models`
も存在し、SSE 進捗付きで起動可能。詳細は `backend/app/routers/setup.py` 参照)

### 3. ベンチ本実行

```bash
python tools/bench-mu/run_inference_bench.py
```

#### オプション

| フラグ | 説明 |
|---|---|
| `--repeat N` | 各 (case, MTP setting) を N 回繰り返す（既定 3）|
| `--max-new-tokens N` | プロンプトごとの上限（個別指定で override）|
| `--no-mtp` | MTP 有効ケースをスキップ（baseline のみ）|
| `--no-mtp-baseline` | baseline をスキップ（MTP 有効のみ）|
| `--prompts FILE` | カスタム prompt 集（JSONL）|
| `--output-dir DIR` | 結果 JSON の保存先（既定 `bench-out/`）|
| `--json` | 集計テーブル無しで JSON のみ出力 |

### 4. 出力解釈

集計テーブル例:

```
Track B Inference Bench  device=GPU.0  repeat=3
  target  : google/gemma-4-E2B-it
  drafter : google/gemma-4-E2B-it-assistant
  prompts : 8  runs=48
==============================================================================
MTP    samples  first-tok p50/p95/p99 ms      tok/sec mean/p50
  OFF       24    180.2/  240.1/  280.5         18.40/ 17.90
  ON        24     90.5/  120.3/  150.2         52.10/ 51.30
------------------------------------------------------------------------------
  MTP speedup factor: 2.83x  (mean tokens/sec ratio)
```

| 指標 | 何を表すか | 期待値（Intel Arc + INT4/INT8）|
|---|---|---|
| first-token latency p50 | 最初の応答 token が出るまでの時間（中央値）| < 200 ms |
| first-token latency p95/p99 | 上位 5%/1% の遅延 | < 500 ms / < 800 ms |
| tokens/sec (mean) | 生成スループット | 30-50 tok/s (target only), 100+ tok/s (MTP on) |
| MTP speedup factor | MTP 有効時のスループット倍率 | 2-3x（理論最大 4x）|

JSON 結果ファイルは `bench-out/bench_results_<UTC timestamp>.json` に保存。
CI でベースライン比較する場合はこの JSON を artifact として保管・diff。

## トラブルシューティング

| 症状 | 原因 / 対処 |
|---|---|
| `check_setup.py` で deps 全部 FAIL | `pip install -U transformers optimum-intel[nncf] openvino huggingface_hub torch` |
| `check_setup.py` で hf_token FAIL | <https://huggingface.co/google/gemma-4-E2B-it> でアクセスリクエスト承認後、`huggingface-cli login` |
| `check_setup.py` で model FAIL | `tools/quantize-models/download_and_quantize.py` を先に実行 |
| `check_setup.py` で openvino_devices CPU only | Intel Arc GPU / NPU のドライバ未インストール。CPU でも動くが速度は出ない |
| ベンチ実行中 `runs[].error` に NotImplementedError | OpenVinoGemmaAdapter の依存欠落。check_setup を再確認 |
| ベンチで `mtp_speedup` < 1.0 | drafter モデルの量子化が aggressive すぎる。INT4 → INT8 へ |
| OOM / メモリ不足 | `--max-new-tokens` を下げる、または `nvtop` / `intel_gpu_top` で他プロセスを停止 |

## CI への組み込み（参考）

```yaml
# .github/workflows/track-b-bench.yml (将来案)
on:
  workflow_dispatch:  # 手動 trigger のみ（実機 self-hosted runner 必須）
jobs:
  bench:
    runs-on: [self-hosted, intel-arc]
    steps:
      - uses: actions/checkout@v4
      - run: python tools/bench-mu/check_setup.py --strict
      - run: python tools/bench-mu/run_inference_bench.py --repeat 3 --output-dir bench-out
      - uses: actions/upload-artifact@v4
        with:
          name: bench-${{ github.sha }}
          path: bench-out/
```

実機がない GitHub-hosted runner では `check_setup.py --strict` が必ず exit 1 になる
（GPU/NPU と HF token が無い）ため、self-hosted runner（社内 Intel Arc 機）が必須。

## 単体テスト（dev 環境で実行可）

deps 無し環境でも実行可能なテスト群:

```bash
cd backend
python tests/test_openvino_adapter_helpers.py   # 6/6 OK 想定（純関数）
python tests/test_downloader_mock.py            # 4/4 OK 想定（mock 駆動）
```

これらは `backend/tests/test_mu_smoke.py` と同じ実行スタイル。
将来 pytest 化する際もそのまま移行可能。
