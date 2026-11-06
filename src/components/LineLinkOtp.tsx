"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { issueLineLinkOtp } from "@/app/actions/line-link";

type IssuedOtp = {
  code: string;
  expiresAt: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "連携コードを発行できませんでした。";
}

export default function LineLinkOtp({ isLinked }: { isLinked: boolean }) {
  const [otp, setOtp] = useState<IssuedOtp | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isIssuing, setIsIssuing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasRequestedInitialCode = useRef(false);

  const issueCode = useCallback(async () => {
    setIsIssuing(true);
    setErrorMessage(null);

    try {
      const result = await issueLineLinkOtp();
      const expiresAt = new Date(result.expiresAt).getTime();
      setOtp({ code: result.code, expiresAt });
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsIssuing(false);
    }
  }, []);

  useEffect(() => {
    if (hasRequestedInitialCode.current) return;
    hasRequestedInitialCode.current = true;
    void issueCode();
  }, [issueCode]);

  useEffect(() => {
    if (!otp) return;

    const updateRemaining = () => {
      setRemainingSeconds(Math.max(0, Math.ceil((otp.expiresAt - Date.now()) / 1000)));
    };
    updateRemaining();
    const intervalId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(intervalId);
  }, [otp]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isExpired = remainingSeconds === 0;

  return (
    <section className="rounded-3xl border-2 border-green-100 bg-white p-5 shadow-sm space-y-3">
      <div>
        <h2 className="font-extrabold text-gray-800">LINEアカウント連携</h2>
        <p className="mt-1 text-sm text-gray-500">
          {isLinked
            ? "LINEアカウントは連携済みです。別のLINEアカウントに変更する場合は、新しいコードを発行してください。"
            : "家計簿アカウントとLINEボットを連携します。"}
        </p>
      </div>

      <p className="text-sm font-bold text-gray-700">
        以下のワンタイムパスワードをLINEボット宛に15分以内に送信してください。
      </p>

      {otp ? (
        <div className="rounded-2xl bg-green-50 p-4 text-center">
          <p className="text-3xl font-extrabold tracking-[0.3em] text-green-700" aria-live="polite">
            {otp.code}
          </p>
          <p className="mt-2 text-sm font-bold text-gray-600" aria-live="polite">
            {isExpired
              ? "有効期限が切れました"
              : `有効期限まで ${minutes}:${String(seconds).padStart(2, "0")}`}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500" aria-live="polite">
          {isIssuing ? "連携コードを発行しています..." : "連携コードはまだ発行されていません。"}
        </p>
      )}

      {errorMessage ? (
        <p className="text-sm font-bold text-rose-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void issueCode()}
        disabled={isIssuing}
        className="w-full rounded-full bg-green-600 px-4 py-3 font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isIssuing ? "発行中..." : otp ? "連携コードを再発行" : "連携コードを発行"}
      </button>
    </section>
  );
}
