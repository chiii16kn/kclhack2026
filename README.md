# Pocke — 家計簿アプリ

Next.js、TypeScript、Supabase、PostgreSQL、Prismaを使った、WebとLINEから記録できる家計簿アプリです。

## はじめに

- [プロジェクト完全ガイド](./PROJECT_GUIDE.md)：技術用語、構成、各ファイルの役割、Web／LINEの処理の流れ、起動・環境設定を説明しています。
- [Prismaのデータベース設計](./prisma/schema.prisma)
- [環境変数の名前と設定例](./.env.example)（実際の秘密値はここに書かず、`.env.local` などに設定してください）

## ローカルで起動する

```bash
npm ci
npm run dev
```

`.env.local` にSupabase、PostgreSQL、LINE Messaging APIの環境変数を設定してから、`http://localhost:3000` を開いてください。変数の一覧と用途は[プロジェクト完全ガイド](./PROJECT_GUIDE.md#環境変数)を参照してください。

よく使う確認コマンド:

```bash
npm run lint
npm run typecheck
npm run build
```
