# KCL☆Hack 2026 バックエンドハンズオン

## 環境構築

### リポジトリの取得とインストール関係

```bash
git clone -b develop git@github.com:Kyutech-Code-Lab/kclhack2026-backend-hands-on.git
cd kclhack2026-backend-hands-on
npm ci
```

### Supabaseプロジェクトの作成

- Supabaseダッシュボードにて New Project を選択
- プロジェクト名とパスワードを入力
- Regionで `Northeast Asia (Tokyo)` を選択
- Securityで`Enable Data API`のチェックを外す
- Securityで`Enable automatic RLS`のチェックを外す

### 環境変数の設定

```bash
cp .env.example .env
```

作成したプロジェクトを開き、`Connect`を選択。
環境変数は次の場所にある。
- `DATABASE_URL`: ORM → Prisma → Configure ORM
- `DIRECT_URL`: ORM → Prisma → Configure ORM
- `NEXT_PUBLIC_SUPABASE_URL`: Framework → Next.js → App Router → Add files
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Framework → Next.js → App Router → Add files

`[YOUR-PASSWORD]`はプロジェクト作成時に設定したパスワードにする。

### Prismaクライアントの作成

```bash
npx prisma generate
```

### テーブルの作成と初期データの投入

```bash
npx prisma db push
npx prisma db seed
```

Prismaのスキーマを変更した場合は、接続先のデータベースに対して `npx prisma db push` を実行してからアプリをデプロイしてください。

### Authenticationの確認
Authentication → URL Configuration → Site URL が `http://localhost:3000`を指していることを確認する

### 起動

```bash
npm run dev
```

ブラウザで次のURLを開く

```text
http://localhost:3000
```

### LINEアカウント連携

ログイン後、ホーム画面の「LINEアカウント連携」に表示された6桁のコードをLINEボットへ5分以内に送信してください。期限切れの場合は、画面からコードを再発行できます。Webhookを利用するには、LINE DevelopersのMessaging APIチャネルにあるChannel access tokenとChannel secretを、それぞれ `LINE_CHANNEL_ACCESS_TOKEN` と `LINE_CHANNEL_SECRET` として環境変数に設定してください。
