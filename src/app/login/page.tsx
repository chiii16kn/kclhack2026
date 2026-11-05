// src/app/login/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const router = useRouter();

  const supabase = createClient();

  // メール・パスワードでのログイン処理
  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setMessage({ text: "ログインしました！ダッシュボードへ移動します...", isError: false });
      router.push("/"); // ログイン成功時にホームへリダイレクト
      router.refresh();
    } catch (error: unknown) {
      setMessage({
        text: getErrorMessage(error, "ログインに失敗しました。"),
        isError: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // LINE OAuthでのログイン処理
  const handleLineLogin = async () => {
    setIsLoading(true);
    setMessage({ text: "LINEを開いています...", isError: false });

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "custom:line",
        options: {
          // 認証後のリダイレクト先（ダッシュボードまたはコールバックURL）
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch {
      setMessage({ text: "LINEログインに失敗しました。", isError: true });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col justify-center items-center p-4 font-sans text-gray-800">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-sm border-2 border-orange-100 p-8 space-y-6">

        {/* ヘッダー部分 */}
        <div className="text-center space-y-2">
          <div className="flex justify-center items-center gap-2 text-4xl font-extrabold text-orange-500 mb-6">
            <span>🐻</span>
            <span>Pocke</span>
          </div>
          <h1 className="text-xl font-bold text-gray-700">おかえりなさい！</h1>
          <p className="text-sm text-gray-400 font-bold">家計簿をつけて、お金を整理しましょう</p>
        </div>

        {/* メッセージ表示エリア */}
        {message && (
          <div className={`p-3 text-sm font-bold rounded-xl text-center ${message.isError ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-600'}`}>
            {message.text}
          </div>
        )}

        {/* メール・パスワードフォーム */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 pl-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pocke@example.com"
              required
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:outline-none focus:border-orange-300 transition-colors font-bold text-gray-700"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 pl-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:bg-white focus:outline-none focus:border-orange-300 transition-colors font-bold text-gray-700"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 mt-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? "処理中..." : "メールでログイン"}
          </button>
        </form>

        {/* 区切り線 */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t-2 border-gray-100"></div>
          <span className="flex-shrink-0 mx-4 text-gray-300 text-xs font-bold">または</span>
          <div className="flex-grow border-t-2 border-gray-100"></div>
        </div>

        {/* LINEログインボタン */}
        <button
          type="button"
          onClick={handleLineLogin}
          disabled={isLoading}
          className="w-full py-3.5 bg-[#06C755] hover:bg-[#05b34c] text-white rounded-full font-bold shadow-sm transition-transform active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
            <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 3.269 8.846 8.14 9.579.317.067.747.206.858.583.1.341.033.868 0 1.222-.05.485-.239 1.436-.289 1.637-.082.333-.333 1.637 1.385.918 1.716-.72 9.317-5.48 11.458-8.887 1.616-2.583 2.448-4.908 2.448-5.052z"/>
          </svg>
          LINEでログイン
        </button>
      </div>
    </div>
  );
}