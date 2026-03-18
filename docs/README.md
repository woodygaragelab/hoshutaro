# HOSHUTARO ドキュメント

## 概要

HOSHUTARO（星取表）は、設備保全履歴管理システムです。Excelライクなインターフェースでプラント設備の保全作業を計画・実績管理できます。

## ドキュメント構成

### アーキテクチャ

| ドキュメント | 内容 |
|---|---|
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | 技術スタック、アーキテクチャパターン、パフォーマンス設計 |
| [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md) | **全型定義の唯一の正**。エンティティ構造、リレーション、ビューモード型、データ移行 |
| [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md) | コンポーネント構造、ディレクトリ構成、状態管理パターン |

### 機能・UI

| ドキュメント | 内容 |
|---|---|
| [FEATURE_SPECIFICATIONS.md](./FEATURE_SPECIFICATIONS.md) | 機能仕様、要件定義、成功基準 |
| [USER_INTERFACE_GUIDE.md](./USER_INTERFACE_GUIDE.md) | UIコンポーネント、キーボードショートカット、ビジュアルデザイン |

### 開発ガイド

| ドキュメント | 内容 |
|---|---|
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Manager統合、ダイアログ統合、サービス層インターフェース、データフロー |

### 運用

| ドキュメント | 内容 |
|---|---|
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | 実装状況、テスト結果、パフォーマンスベンチマーク |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | テスト戦略、テスト構成、実行方法 |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | トラブルシューティングガイド、デバッグ方法 |

## クイックスタート

### 開発者向け

1. [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) でアーキテクチャを理解
2. [DATABASE_STRUCTURE.md](./DATABASE_STRUCTURE.md) でデータモデルを把握
3. [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) で統合パターンを習得

### 新機能追加時

1. [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md) でコンポーネントパターンを確認
2. [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) の統合チェックリストに従う
3. [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) に基づいてテストを追加

## ドキュメント管理ルール

1. **型定義の変更** → `DATABASE_STRUCTURE.md` のみ更新（唯一の正）
2. **新規ドキュメントは作成しない** → 既存ドキュメントに追記する
3. **コンポーネント固有情報** → 各コンポーネントの `README.md` に記載
4. **統合パターン** → `INTEGRATION_GUIDE.md` に集約
