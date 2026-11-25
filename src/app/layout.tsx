// src/app/layout.tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";
import { AuthStatus } from "@/components/containers/AuthStatus"; // 残しておいた認証UIコンポーネント

export const metadata: Metadata = {
  title: "Pocke - 家計簿アプリ",
  description: "事前予算配分型の家計簿アプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {/* 全画面共通のヘッダー */}
        <header className="flex justify-between items-center px-6 py-4 bg-white border-b shadow-sm">
          <Link href="/" aria-label="Pocke ホームへ">
            <Image src="/logo.png" alt="Pocke" width={416} height={160} priority className="h-10 w-auto" />
          </Link>
          {/* ここにログイン・ログアウトボタンを配置 */}
          <AuthStatus />
        </header>
        
        {/* 各ページのメインコンテンツ（page.tsxの中身）がここに入ります */}
        <div className="max-w-4xl mx-auto py-8">
          {children}
        </div>
      </body>
    </html>
  );
}