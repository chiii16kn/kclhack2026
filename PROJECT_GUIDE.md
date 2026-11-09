# Pocke 家計簿アプリ — プロジェクト完全ガイド

この文書は、プログラミングやWeb開発を初めて学ぶ人が、アプリの目的、使っている技術、ファイルの役割、データが流れる道筋を順に理解できるようにまとめたものです。説明は現在のリポジトリの実装に基づいています。

> **このアプリの大切な考え方:** Supabaseは「誰がログインしているか」を確認し、Prismaを通じてPostgreSQLに家計簿データを保存します。Web画面からもLINEからも、最終的には同じユーザーのデータに記録します。

## 1. このアプリでできること

- メールアドレスとパスワードでユーザー登録・ログインする
- 毎月の収入（使えるお金）を設定し、カテゴリごとに予算を配分する
- 支出をWeb画面から手動で記録する
- 予算を使った額、残額、未配分額を確認する
- カテゴリごとの「1日あたり」または「月の利用回数あたり」の目安額を確認する
- 予算が未配分、またはカテゴリが赤字のとき、画面で予算配分・赤字補填を行う
- ユーザー自身のカテゴリをWebまたはLINEから追加する
- ワンタイムパスワード（OTP）でWebアカウントとLINE公式アカウントを連携・解除する
- LINEに決まった形式でメッセージを送り、支出や収入を記録する

## 2. まず知っておきたい用語

### JavaScriptとTypeScript

**JavaScript**は、Webページに動きや処理を加えるプログラミング言語です。画面のボタンを押したときの反応、フォームの値の読み取り、サーバーへの通信などを書けます。ブラウザだけでなく、Node.jsという実行環境を使えばサーバー側でも動かせます。

**TypeScript（TS）**はJavaScriptに「値の種類（型）」を付けた言語です。たとえば「この値は文字列」「この関数は数値を返す」と明示できます。実行前に間違いを見つけやすくするための仕組みで、実行時にはJavaScriptに変換されます。`.ts`はTypeScriptの処理ファイル、`.tsx`はTypeScriptの中にHTML風の画面記述（JSX）を含むファイルです。

### 画面・サーバー・データベース

- **React**: 画面を部品（コンポーネント）に分けて作るJavaScriptライブラリです。入力値や開閉状態など、画面の変化も管理します。
- **Next.js**: Reactを使ったWebアプリの土台です。このプロジェクトでは、URLに対応する画面、サーバー処理、LINEから呼び出すAPIを一つのリポジトリで管理します。
- **App Router**: Next.jsのルーティング方式です。`src/app/page.tsx`は`/`、`src/app/login/page.tsx`は`/login`の画面になります。`src/app/api/webhook/route.ts`は`/api/webhook`というAPIになります。
- **サーバーコンポーネント／クライアントコンポーネント**: サーバーコンポーネントはサーバー上で実行され、DBからデータを読んで画面を作れます。クライアントコンポーネントはブラウザ上で実行され、クリック・入力・タイマーなどを扱います。ファイル先頭に`"use client"`がある場合、そのファイルはクライアント側の動きを含みます。
- **Server Action**: Next.jsの仕組みで、画面のフォームからサーバー上の関数を呼び出します。`"use server"`の付いたファイルに定義します。ブラウザにDB接続情報を渡さずに保存処理できます。
- **API／Webhook**: APIはソフトウェア同士が決められた方法で通信する窓口です。Webhookは、LINEなど外部サービス側でイベントが起きたとき、そのサービスからアプリのAPIへ通知する方式です。
- **PostgreSQL**: 表（テーブル）形式でデータを保存するデータベースです。Supabaseのプロジェクト内で使用しています。
- **ORM**: プログラムのオブジェクトとデータベースの表を対応させる仕組みです。SQLを直接書く代わりに、型の付いたコードでデータの読み書きができます。
- **Prisma／Prisma Client**: このアプリのORMです。`prisma/schema.prisma`で表の設計を定義し、生成されたPrisma Clientを`prisma.user.findUnique(...)`などのTypeScriptコードから使用します。
- **Supabase Auth**: メール・パスワードでの登録やログイン、ログイン状態を管理するサービスです。家計簿のカテゴリや取引を保存するPostgreSQLと同じSupabaseプロジェクトを使いますが、認証情報と家計簿のデータは別の役割です。
- **環境変数**: DB接続先や外部APIの鍵など、コードに直接書きたくない設定値です。`.env.local`などに置き、Gitに登録しないようにします。
- **Tailwind CSS**: HTML要素のクラス名に見た目の指定を記述するCSSツールです。たとえば`bg-white`は白い背景、`rounded-3xl`は大きく角を丸める指定です。
- **OTP（ワンタイムパスワード）**: 1回だけ使える短い認証コードです。このアプリでは6桁の数字をLINEから送信し、Webの家計簿アカウントと送信元LINEユーザーを結び付けます。
- **HMAC署名**: LINEから来たWebhookが正規の送信元から届き、内容が途中で改変されていないか確認するための電子署名です。

## 3. 技術同士のつながり

```text
利用者のブラウザ
  ├─ Next.js / React の画面
  │    ├─ Supabase Auth（登録・ログイン・ログイン状態）
  │    └─ Server Actions ───────────────┐
  │                                      │
  └─ Cookie（ログインセッション）         │
                                         ▼
LINE利用者                         Next.jsサーバー
  └─ LINE公式アカウント                 ├─ Supabase Authで利用者を確認
       └─ Messaging API                 ├─ Prisma ClientでDBを読み書き
            └─ Webhook POST ────────────┤
                                         └─ PostgreSQL（Supabase）
```

ポイントは、ブラウザやLINEがデータベースに直接接続するのではなく、Next.jsサーバーが間に入ることです。WebではServer Action、LINEではWebhook APIがサーバーへの入口になります。サーバーはPrismaを使ってPostgreSQLにアクセスします。

## 4. 主要なデータの設計

設計図は[`prisma/schema.prisma`](./prisma/schema.prisma)にあります。モデルはデータベースの表に相当し、各モデルのフィールドは表の列に相当します。

| モデル | 何を保存するか | 主な関係 |
|---|---|---|
| `User` | アプリのユーザー、メール、LINE ID、予算超過時の設定 | 口座・カテゴリ・取引・月次予算・収入・OTPを持つ |
| `OtpCode` | 6桁コード、所有ユーザー、有効期限 | `userId`が一意なので、ユーザーごとのOTPは同時に1件 |
| `Account` | 現金や銀行口座の名前 | 1ユーザーが複数口座を持てる |
| `Category` | 食費などのカテゴリ名、固定費かどうか、利用目安の設定 | 1ユーザーが複数カテゴリを持てる |
| `MonthlyIncome` | 年月ごとの収入・利用可能総額 | 同一ユーザー・同一年月の行は1件 |
| `MonthlyBudget` | 年月ごとにカテゴリへ割り当てた予算 | 同一カテゴリ・同一年月の行は1件 |
| `Transaction` | 支出／収入の記録、金額、日付、メモ | ユーザー・口座・カテゴリに関連する |

### 重要なデータの関係

- Supabase AuthのユーザーIDを、Prismaの`User.id`にも使います。これにより「ログインしている人」と「家計簿データの所有者」を同じIDで対応付けます。
- `User.lineId`はLINE上のユーザーIDです。NULLなら未連携、値があればそのLINEアカウントと連携済みです。unique制約により、同じLINEアカウントを複数の家計簿ユーザーに紐付けません。
- `Category`は月をまたいで使うカテゴリの定義です。一方、予算額は月ごとに変わるため、別表の`MonthlyBudget`に`yearMonth`と金額を保存します。
- 固定費も`Category.isFixed`で表し、その月額予算はその月の`MonthlyBudget`に保存します。カテゴリを作ることと、月ごとの予算額を持つことは別のデータです。
- 金額の型は主に整数（円）です。年月は`2026-11`のような文字列で保存されます。

## 5. 主な機能の動き

### 登録とログイン

1. `/signup`画面でメールアドレスとパスワードを入力します。
2. [`src/app/signup/actions.ts`](./src/app/signup/actions.ts)がSupabase Authに認証ユーザーを作成します。
3. 同じIDとメールアドレスでPrismaの`User`を作り、最初の口座と「食費」「日用品」「交際費」「家賃」カテゴリも登録します。
4. `/login`ではブラウザ側のSupabaseクライアントが`signInWithPassword`を呼び、ログインCookieを設定します。
5. [`src/proxy.ts`](./src/proxy.ts)から[`src/lib/supabase/proxy.ts`](./src/lib/supabase/proxy.ts)を通り、リクエストごとにSupabaseのセッション情報を更新します。
6. ホーム画面はサーバー側でセッションのユーザーを取得し、その人の家計簿データだけを読み込みます。

ホーム画面を表示するにはログインが必要ですが、proxyの役割はセッション更新です。各画面・Server Action自体の認証処理と混同しないcoでください。

### ホーム画面と予算

[`src/app/page.tsx`](./src/app/page.tsx)はログインユーザーの月次収入、カテゴリ、カテゴリ予算、今月の支出をPrismaから読み込みます。集計・表示する主な数字は次のとおりです。

- **配分した合計**: 表示中の月に各カテゴリへ割り当てた予算の合計
- **未配分額**: 月次収入 − 配分した合計
- **使ったお金**: 今月の支出取引の合計
- **ぜんぶの残金**: 月次収入 − 今月の支出合計
- **カテゴリ残額**: カテゴリの月予算 − そのカテゴリの今月の支出

ユーザーは収入を更新し、各カテゴリの予算を保存できます。未配分額が正、または赤字カテゴリがある場合、[`src/components/ActionRequiredModal.tsx`](./src/components/ActionRequiredModal.tsx)が表示されます。未配分額をカテゴリに割り当てる処理と、赤字を補う処理は[`src/app/actions/resolve.ts`](./src/app/actions/resolve.ts)が担当します。

変動費カテゴリでは、残額を「月末までの日数」または「目標利用回数の残り」で割り、1日／1回あたりの目安を表示します。カテゴリごとの割り方、目標回数、同じ日の支出を1回にまとめる設定は、[`src/components/CategorySettingsButton.tsx`](./src/components/CategorySettingsButton.tsx)と[`src/components/CategorySettingsModal.tsx`](./src/components/CategorySettingsModal.tsx)から変更し、[`src/app/actions/category.ts`](./src/app/actions/category.ts)で保存します。

Webからの支出はホーム画面のフォームから入力します。[`src/app/actions/transaction.ts`](./src/app/actions/transaction.ts)が口座を選択または作成し、取引を保存します。

### カテゴリ追加（Web）

ホーム画面の[`src/components/CreateCategoryForm.tsx`](./src/components/CreateCategoryForm.tsx)で、名前と固定費／変動費を入力します。固定費の場合は月額予算も必要です。

フォームはServer Actionの[`createCategory`](./src/app/actions/category.ts)を呼びます。アクションはログインユーザーを確認し、入力を検証し、カテゴリを作成します。固定費なら同じDBトランザクション内で当月分の`MonthlyBudget`も作成します。DBトランザクションは、一連の保存をまとめ、途中で失敗した場合に不完全な状態が残らないようにする仕組みです。

### LINE連携

#### コード発行（Web）

1. ホーム画面の[`src/components/LineLinkOtp.tsx`](./src/components/LineLinkOtp.tsx)が連携状態を確認します。
2. 未連携なら[`src/app/actions/line-link.ts`](./src/app/actions/line-link.ts)の`issueLineLinkOtp`が6桁OTPを作成し、有効期限を5分後に設定してDBへ保存します。
3. そのユーザーの古いOTPを削除してから発行するため、有効なコードは常に最新の1つです。コードの衝突時は再生成します。
4. コンポーネントは残り時間を1秒ごとに更新し、手動で再発行もできます。また、連携状態を定期確認して、成功後はOTP表示を隠します。

#### LINEからコードを送る

LINE利用者が6桁の数字を送ると、[`src/app/api/webhook/route.ts`](./src/app/api/webhook/route.ts)がOTPとして扱います。有効であれば、OTP所有者の`User.lineId`を送信元LINEユーザーIDに更新し、OTPを削除します。すでに別のアカウントに使われているLINE IDはunique制約で拒否されます。

連携解除は同じ画面のボタンから行います。サーバーは現在のLINE IDを読み取り、DBの連携とOTPを削除してから、LINE Messaging APIのPush APIで解除通知を送ります。通知が失敗した場合、Web画面には解除処理と通知の結果が別々に表示されます。

### LINEから収支を記録する

LINE DevelopersでMessaging APIのWebhook URLを、公開Webサイトの`https://<ドメイン>/api/webhook`に設定します。Webhook APIは次の順で処理します。

1. LINEの`x-line-signature`ヘッダーを、`LINE_CHANNEL_SECRET`を使ったHMACで検証します。不正な署名は401を返します。
2. 受信イベントから送信元LINEユーザーIDとメッセージを読み取ります。
3. **6桁の数字だけ**なら家計簿の金額ではなくOTPとして処理します。
4. それ以外のメッセージは`User.lineId`を検索し、連携ユーザーを確認します。見つからなければWeb登録とOTP連携を案内し、家計簿データは作りません。
5. 連携済みのユーザーなら、`カテゴリ名 金額`（例: `食費 1200`）を支出として記録します。金額だけなら食費として記録します。
6. `収入 50000`など収入キーワードの場合は、`MonthlyIncome`の今月分に金額を加算します。
7. 返信には登録結果、カテゴリ残額、変動費の目安額などを含めます。予算超過の場合は設定に応じた案内も行います。

メッセージ形式が不正な場合や、未登録カテゴリが指定された場合は利用可能なカテゴリと入力形式を返信します。LINEでカテゴリを作成する場合は、明示的に次のコマンドを送ります。

```text
カテゴリ追加 趣味 変動費
カテゴリ追加 通信費 固定費 8000
```

固定費の最後の数字は月額予算（円）です。作成はDBトランザクションで行い、固定費なら当月分の予算も一緒に保存します。LINEとWebでカテゴリを作った後は同じ`Category`データを参照します。

> 6桁の数字はOTPとして予約されています。そのため、金額だけの支出登録で6桁を使うと、支出ではなくOTP認証として扱われます。

## 6. ファイル別の役割

### アプリの画面・API

| ファイル | 役割 |
|---|---|
| [`src/app/page.tsx`](./src/app/page.tsx) | `/`の家計簿ダッシュボード。ユーザー確認、今月のDB読み込み、集計、各画面部品の配置 |
| [`src/app/layout.tsx`](./src/app/layout.tsx) | 全ページを包むHTML枠、共通ヘッダー、ページタイトルなどのメタデータ |
| [`src/app/globals.css`](./src/app/globals.css) | 全画面で読み込むCSS変数とTailwind CSSの読み込み |
| [`src/app/login/page.tsx`](./src/app/login/page.tsx) | `/login`。ブラウザ側でログインフォームとエラー表示を処理 |
| [`src/app/login/actions.ts`](./src/app/login/actions.ts) | Server Action形式のログイン処理。現在のログイン画面はブラウザ側処理を使用 |
| [`src/app/signup/page.tsx`](./src/app/signup/page.tsx) | `/signup`。メールとパスワードを入力する新規登録画面 |
| [`src/app/signup/actions.ts`](./src/app/signup/actions.ts) | Supabase Authユーザーと家計簿DBユーザー、初期口座・カテゴリを作成 |
| [`src/app/api/webhook/route.ts`](./src/app/api/webhook/route.ts) | `/api/webhook`。LINE署名確認、OTP連携、LINEからの収支・カテゴリ登録、LINE返信 |
| [`src/app/api/cron/daily-reminder/route.ts`](./src/app/api/cron/daily-reminder/route.ts) | `/api/cron/daily-reminder`。日本時間当日の支出集計と、LINEへの入力確認通知 |

### サーバー処理（Server Actions）

| ファイル | 役割 |
|---|---|
| [`src/app/actions/budget.ts`](./src/app/actions/budget.ts) | 月次収入とカテゴリ予算の作成・更新 |
| [`src/app/actions/category.ts`](./src/app/actions/category.ts) | カテゴリ作成、カテゴリの計算方法・回数・同日まとめ設定の更新 |
| [`src/app/actions/line-link.ts`](./src/app/actions/line-link.ts) | LINE連携状態の照会、OTP発行、連携解除、解除通知 |
| [`src/app/actions/resolve.ts`](./src/app/actions/resolve.ts) | 未配分予算のカテゴリへの追加、赤字カテゴリへの補填 |
| [`src/app/actions/transaction.ts`](./src/app/actions/transaction.ts) | Webフォームから支出取引を作成 |
| [`src/app/actions/user.ts`](./src/app/actions/user.ts) | 予算超過時の動作を「補填」または「警告のみ」に更新 |

### 画面部品

| ファイル | 役割 |
|---|---|
| [`src/components/ActionRequiredModal.tsx`](./src/components/ActionRequiredModal.tsx) | 未配分額を配る、または赤字カテゴリを補填するモーダル |
| [`src/components/CategorySettingsButton.tsx`](./src/components/CategorySettingsButton.tsx) | カテゴリ設定モーダルを開くボタン |
| [`src/components/CategorySettingsModal.tsx`](./src/components/CategorySettingsModal.tsx) | 1日／目標回数の計算方法と同日まとめの設定フォーム |
| [`src/components/CreateCategoryForm.tsx`](./src/components/CreateCategoryForm.tsx) | Webからカテゴリ名・種類・固定費予算を入力するフォーム |
| [`src/components/LineLinkOtp.tsx`](./src/components/LineLinkOtp.tsx) | OTP表示、残り時間、再発行、連携済み表示、解除 |
| [`src/components/containers/AuthStatus.tsx`](./src/components/containers/AuthStatus.tsx) | ヘッダーのログイン状態、メールアドレス、ログアウト表示 |
| [`src/components/containers/Header.tsx`](./src/components/containers/Header.tsx) | 汎用ヘッダー部品。現在の共通レイアウトはヘッダーを直接記述している |
| [`src/components/ui/Badge.tsx`](./src/components/ui/Badge.tsx) | ラベル表示用の小さな再利用部品 |
| [`src/components/ui/Button.tsx`](./src/components/ui/Button.tsx) | 共通ボタン部品 |
| [`src/components/ui/Input.tsx`](./src/components/ui/Input.tsx) | 共通入力部品 |
| [`src/components/ui/Select.tsx`](./src/components/ui/Select.tsx) | 共通選択部品 |

### DB、認証、設定

| ファイル | 役割 |
|---|---|
| [`prisma/schema.prisma`](./prisma/schema.prisma) | PostgreSQLに作るテーブル、列、型、関連、unique制約の定義 |
| [`prisma.config.ts`](./prisma.config.ts) | Prisma CLI設定。`.env.local`、`.env`から環境変数を読み、`DATABASE_URL`を使う |
| [`src/lib/prisma.ts`](./src/lib/prisma.ts) | PostgreSQL接続プール、Prisma 7用Postgresアダプター、Prisma Clientの共有インスタンス |
| [`src/lib/supabase/client.ts`](./src/lib/supabase/client.ts) | ブラウザ用Supabaseクライアント |
| [`src/lib/supabase/server.ts`](./src/lib/supabase/server.ts) | Server Component、Server Action、Route Handler用Supabaseクライアント。Cookieを介してセッションを扱う |
| [`src/lib/supabase/proxy.ts`](./src/lib/supabase/proxy.ts) | リクエスト時に認証Cookieを読み、必要に応じてセッションを更新 |
| [`src/lib/supabase/env.ts`](./src/lib/supabase/env.ts) | Supabase URLと公開可能キーを読み、未設定時はエラーにする |
| [`src/lib/form-data.ts`](./src/lib/form-data.ts) | `FormData`から文字列だけを安全に取り出す小さなヘルパー |
| [`src/proxy.ts`](./src/proxy.ts) | Next.jsから呼び出されるproxyの入口。Supabaseセッション更新処理へつなぐ |

### ルート設定・開発補助

- [`package.json`](./package.json): 依存パッケージと`dev`、`lint`、`typecheck`、`build`などのnpmコマンド。
- [`package-lock.json`](./package-lock.json): インストールされる依存パッケージのバージョンを固定するnpmのロックファイル。
- [`tsconfig.json`](./tsconfig.json): TypeScriptのチェック設定。`@/`を`src/`の別名として使えるようにします。
- [`next.config.ts`](./next.config.ts): Next.js設定。React Compilerを有効にしています。
- [`eslint.config.mjs`](./eslint.config.mjs): ESLintによるコード検査の設定。
- [`postcss.config.js`](./postcss.config.js)、[`tailwind.config.ts`](./tailwind.config.ts)、[`tailwind.config.js`](./tailwind.config.js): CSS処理とTailwind関連の設定。
- [`.env.example`](./.env.example): 必要な環境変数名と値の書式例。秘密値は含めません。
- [`.gitignore`](./.gitignore): `node_modules`、ビルド生成物、`.env*`などGitへ登録しないファイルの指定。
- [`public/`](./public): 画像やSVGなど、URLから直接配信する静的ファイル。
- [`task/`](./task): 元のバックエンドハンズオン教材。現在の家計簿アプリの機能説明ではなく、認証・DB・API Routeを学ぶための教材メモです。

## 7. 使っている主なパッケージ

| パッケージ | 用途 |
|---|---|
| `next` | 画面ルーティング、サーバー処理、API、ビルド |
| `react` / `react-dom` | UIコンポーネントとブラウザ上の画面 |
| `typescript` | 型チェックを行う開発言語 |
| `@supabase/ssr` | Next.jsのサーバー／ブラウザ間でSupabase AuthのCookieを扱う |
| `@supabase/supabase-js` | Supabase Auth APIとの通信 |
| `prisma` / `@prisma/client` | DBスキーマ管理とTypeScriptからのDBアクセス |
| `pg` / `@prisma/adapter-pg` | PostgreSQLとの接続、およびPrisma 7のPostgreSQLアダプター |
| `@line/bot-sdk` | LINE Bot SDKの依存パッケージ。Webhookのメッセージ返信は現状`fetch`でLINE Messaging APIへ直接通信 |
| `tailwindcss` | CSSクラスによる画面スタイリング |
| `eslint` / `eslint-config-next` | コード上の問題やNext.jsの推奨パターンを検査 |
| `dotenv` | Prisma設定実行時に`.env.local`や`.env`を読み込む |

## 8. 環境変数

設定例は[`.env.example`](./.env.example)を参照し、実際の値は`.env.local`などに設定します。秘密値をソースコードやGitに登録しないでください。

| 変数 | 何に使うか |
|---|---|
| `DATABASE_URL` | PrismaからPostgreSQLへ接続するURL。アプリ実行時のDB接続にも使う |
| `DIRECT_URL` | 接続文字列の例として存在する。現在の`prisma.config.ts`では`DATABASE_URL`を指定しており、このリポジトリ内では直接参照していない |
| `NEXT_PUBLIC_SUPABASE_URL` | ブラウザとサーバーがSupabaseプロジェクトを特定するURL。`NEXT_PUBLIC_`はブラウザ側コードでも参照される設定を表す |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabaseクライアントの公開可能キー。サーバー秘密鍵やDBパスワードとは異なる |
| `LINE_CHANNEL_ACCESS_TOKEN` | サーバーからLINE Messaging APIへ返信・Push通知するときに使う秘密トークン |
| `LINE_CHANNEL_SECRET` | LINE Webhook署名の検証に使う秘密値 |
| `CRON_SECRET` | 日次リマインダーAPIをVercel Cronから呼び出すための秘密値 |

LINEのWebhook URLには、公開済み環境の`https://<ドメイン>/api/webhook`を設定します。LINEからそのURLへ到達できる必要があります。プレビュー環境に認証ゲートがかかっているとLINEがWebhookに到達できないため、Webhookを公開URLから利用可能にしてください。

## 日次のLINEリマインダー

[`vercel.json`](./vercel.json)で毎日12:00 UTC（日本時間21:00）に[`src/app/api/cron/daily-reminder/route.ts`](./src/app/api/cron/daily-reminder/route.ts)を呼び出します。Vercelの本番環境に`CRON_SECRET`と`LINE_CHANNEL_ACCESS_TOKEN`を設定してください。LINE連携済みのユーザーへ当日の支出合計と件数を送り、支出記録がない場合も入力忘れがないか確認するメッセージを送ります。日付の集計は日本時間です。

Vercel以外で運用する場合は、毎日日本時間21:00に同APIを`Authorization: Bearer <CRON_SECRET>`ヘッダー付きで呼び出すスケジューラーを設定してください。

## 9. 開発・DB更新・確認

```bash
# 依存関係をロックファイルどおりにインストール
npm ci

# Prisma Clientを生成（dev/build/typecheckの前処理でも実行）
npx prisma generate

# schema.prismaの設計を接続先DBへ反映（初回やスキーマ変更時）
npx prisma db push

# ローカル開発サーバー
npm run dev

# 静的コード検査、型チェック、本番相当ビルド
npm run lint
npm run typecheck
npm run build
```

`schema.prisma`を変更しただけでは、既存のSupabaseデータベースのテーブルは自動で変わりません。変更内容を確認してから接続先に`npx prisma db push`を行い、必要ならデプロイ先でも同じ環境変数を設定します。`npm run build`はコードのビルド確認であり、DBのスキーマ更新を行う操作ではありません。

## 10. 実装を読むときの順番

初めて読む場合は、次の順番がおすすめです。

1. [`src/app/page.tsx`](./src/app/page.tsx) — 利用者が見る画面と表示データを把握する
2. [`prisma/schema.prisma`](./prisma/schema.prisma) — 画面のデータがどの表に保存されるか見る
3. [`src/lib/prisma.ts`](./src/lib/prisma.ts) — サーバーからDBへつなぐ方法を見る
4. [`src/lib/supabase/server.ts`](./src/lib/supabase/server.ts) — サーバー側でログイン中ユーザーを確認する方法を見る
5. [`src/app/actions/budget.ts`](./src/app/actions/budget.ts) — WebフォームからDB保存へ至る一つの流れを追う
6. [`src/components/LineLinkOtp.tsx`](./src/components/LineLinkOtp.tsx)と[`src/app/actions/line-link.ts`](./src/app/actions/line-link.ts) — ブラウザUIとServer Actionの連携を見る
7. [`src/app/api/webhook/route.ts`](./src/app/api/webhook/route.ts) — LINEからサーバーへ届くWebhookとDB記録を見る

## 11. 現在の実装で気を付けたい点

この節は追加機能ではなく、コードを読むと分かる現状の挙動です。

- [`src/app/actions/transaction.ts`](./src/app/actions/transaction.ts)と[`src/app/actions/user.ts`](./src/app/actions/user.ts)には、未ログイン時にDBの先頭ユーザーを対象にする検証用フォールバックが残っています。公開環境では、別ユーザーのデータを書き換える可能性があるため、実運用前に未ログインなら拒否するよう変更すべきです。
- [`src/app/signup/actions.ts`](./src/app/signup/actions.ts)ではSupabase Auth登録後のPrisma登録エラーをログに出したうえで処理を続けます。そのため、Authユーザーはできたが家計簿用`User`行の作成に失敗する状態が起き得ます。登録時にメール確認を要求するSupabase設定の場合、登録直後にホームへ移動してもログイン状態にならないことがあります。
- [`src/app/login/actions.ts`](./src/app/login/actions.ts)はServer Actionとして存在しますが、現在の[`src/app/login/page.tsx`](./src/app/login/page.tsx)はブラウザ用Supabaseクライアントからログインしています。二つは別の実装経路です。
- LINEの`replyLine`はAPI失敗をサーバーログに記録しますが、返信に失敗してもWebhook全体が必ずエラー応答になる設計ではありません。LINE側にデータが保存されたのに返信が見えない場合、DB処理とLINE返信APIの結果を分けて調べる必要があります。
- `task/`の教材文書、共通Header／UI部品、Tailwind設定ファイルには、現在の家計簿画面で使われていない旧ハンズオン由来の内容も含まれます。リポジトリにファイルがあることと、実行中の画面で使われていることは同じではありません。
- テスト用の自動化テストは`package.json`に登録されていません。`lint`・`typecheck`・`build`は静的検査とビルド確認であり、実際のSupabase・LINE連携まで自動で検証するものではありません。
