# 保守太郎 (HOSHUTARO)

設備保全計画管理 PWA — AI アシスタント付きメンテナンスグリッド

## 必要環境

| ツール | バージョン | 確認コマンド |
|---|---|---|
| **Node.js** | 20 以上 | `node -v` |
| **npm** | 10 以上 | `npm -v` |
| **Python** | 3.11 以上 | `python --version` |
| **Git** | 任意 | `git --version` |

## インストール手順

### 1. リポジトリのクローン

```bash
git clone https://github.com/woodygaragelab/hoshutaro.git
cd hoshutaro
```

### 2. フロントエンド依存パッケージのインストール

```bash
npm install
```

### 3. バックエンド依存パッケージのインストール

```bash
cd backend
pip install -r requirements.txt
cd ..
```

> **注:** OpenVINO 関連パッケージ (`openvino`, `openvino-genai`, `openvino-tokenizers`) はオプションです。
> ローカルLLM を使わない場合は、`requirements.txt` から該当行をコメントアウトしてください。

### 4. 環境変数の設定

`backend/.env` を編集して、最低限以下を設定します。

```env
# Gemini API Key (必須 — AI アシスタント機能に必要)
GEMINI_API_KEY=your_gemini_api_key_here

# 開発モード (true にするとプラグインのクォータ制限が緩和されます)
DEV_MODE=true
```

Gemini API Key は [Google AI Studio](https://aistudio.google.com/apikey) から無料で取得できます。

### 5. 起動

```bash
npm run dev
```

これだけで**フロントエンド (port 5173) + バックエンド (port 8000)** が同時に起動します。

ブラウザで **http://localhost:5173** を開いてください。

## 起動確認

起動に成功すると、ターミナルに以下のように表示されます。

```
[frontend] VITE v6.x.x ready in xxx ms
[frontend]   ➜ Local:   http://localhost:5173/
[backend]  INFO:     Application startup complete.
```

## 使い方

### データの取り込み

1. 画面下部の AgentBar にある **↑（インポート）** ボタンからExcelファイルをアップロード
2. または JSON ファイルをインポート

### AI アシスタント

画面下部のチャットアイコン (💬) をクリックすると AI チャットが開きます。

### プラグイン管理

画面下部の **🧩（パズル）アイコン** から：
- **プラグイン管理** — 外部システム連携プラグインのインストール・設定
- **スキル実行** — AI スキル（Maximo インポート/エクスポート等）の実行

## プロジェクト構成

```
hoshutaro/
├── src/                          # フロントエンド (React + TypeScript)
│   ├── components/               # UI コンポーネント
│   │   ├── AgentBar/             # ツールバー + AI チャット
│   │   ├── PluginManager/        # プラグイン管理ダイアログ
│   │   ├── SkillRunner/          # スキル実行ダイアログ
│   │   └── EnhancedMaintenanceGrid/  # メインテナンスグリッド
│   └── services/                 # API クライアント・データ管理
│       └── integration/          # プラグイン API サービス
├── backend/                      # バックエンド (FastAPI + Python)
│   ├── app/
│   │   ├── routers/              # REST API エンドポイント
│   │   ├── services/             # ビジネスロジック
│   │   └── llm/                  # LLM アダプタ (レガシー)
│   ├── skills/                   # Skill YAML 定義
│   ├── .env                      # 環境変数
│   └── requirements.txt
├── docs/                         # 開発者ドキュメント
├── launcher/                     # System Tray ランチャー (スタブ)
├── build/                        # ビルドスクリプト (スタブ)
└── plugin-registry.json          # プラグインレジストリ
```

## 主要コマンド

| コマンド | 説明 |
|---|---|
| `npm run dev` | フロントエンド + バックエンド同時起動 |
| `npm run dev:frontend` | フロントエンドのみ起動 |
| `npm run dev:backend` | バックエンドのみ起動 |
| `npm run build` | プロダクションビルド |
| `npm run lint` | ESLint 実行 |
| `npm test` | テスト実行 |

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + TypeScript + Vite 6 + MUI 7 |
| バックエンド | FastAPI + Python 3.11+ |
| AI | Gemini API (ビルトイン) + MCP Server プラグイン |
| データ | IndexedDB (フロントエンド) + JSON/Excel (インポート/エクスポート) |

## ドキュメント

プラグイン開発者向けドキュメントは [docs/README.md](docs/README.md) を参照してください。

## ライセンス

Private
