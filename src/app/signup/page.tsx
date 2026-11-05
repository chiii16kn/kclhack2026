import Link from "next/link";
import { signup } from "./actions";

type SignupPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { error, message } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-orange-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800">
      <section className="w-full max-w-md bg-white rounded-[2rem] shadow-sm border-2 border-orange-100 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center items-center gap-2 text-4xl font-extrabold text-orange-500 mb-6">
            <span>🐻</span>
            <span>Pocke</span>
          </div>
          <h1 className="text-xl font-bold text-gray-700">アカウント作成</h1>
          <p className="text-sm text-gray-400 font-bold">
            メールアドレスとパスワードを登録してください
          </p>
        </div>

        {error === "failed" ? (
          <p className="p-3 text-sm font-bold rounded-xl text-center bg-rose-50 text-rose-500">
            アカウントを作成できませんでした。メールアドレスとパスワード（6文字以上）を確認してください。
          </p>
        ) : null}
        {message === "sent" ? (
          <p className="p-3 text-sm font-bold rounded-xl text-center bg-teal-50 text-teal-600">
            確認メールを送信しました。メール内のリンクから確認を完了してください。
          </p>
        ) : null}

        <form action={signup} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 pl-1" htmlFor="email">
              メールアドレス
            </label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:outline-none focus:border-orange-300 transition-colors font-bold text-gray-700"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 pl-1" htmlFor="password">
              パスワード（6文字以上）
            </label>
            <input
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:outline-none focus:border-orange-300 transition-colors font-bold text-gray-700"
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>

          <button
            className="w-full py-3.5 mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold shadow-sm transition-transform active:scale-95"
            type="submit"
          >
            アカウントを作成
          </button>
        </form>

        <div className="text-center">
          <Link
            className="text-sm font-bold text-orange-600 hover:text-orange-700"
            href="/login"
          >
            ログインに戻る
          </Link>
        </div>
      </section>
    </div>
  );
}
