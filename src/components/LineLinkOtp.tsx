"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isLineAccountLinked,
  issueLineLinkOtp,
  unlinkLineAccount,
} from "@/app/actions/line-link";

type IssuedOtp = {
  code: string;
  expiresAt: number;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "LINE連携の処理に失敗しました。";
}

export default function LineLinkOtp({ isLinked }: { isLinked: boolean }) {
  const [linked, setLinked] = useState(isLinked);
  const [otp, setOtp] = useState<IssuedOtp | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const issueCode = useCallback(async () => {
    setIsIssuing(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await issueLineLinkOtp();
      const expiresAt = new Date(result.expiresAt).getTime();
      setOtp({ code: result.code, expiresAt });
      setRemainingSeconds(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    } catch (error: unknown) {
      try {
        const accountIsLinked = await isLineAccountLinked();
        if (accountIsLinked) {
          setLinked(true);
          setOtp(null);
          setRemainingSeconds(0);
          return;
        }
      } catch (statusError: unknown) {
        setErrorMessage(getErrorMessage(statusError));
        return;
      }
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsIssuing(false);
    }
  }, []);

  const unlinkAccount = useCallback(async () => {
    setIsUnlinking(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const result = await unlinkLineAccount();
      setLinked(false);
      setOtp(null);
      setRemainingSeconds(0);
      setStatusMessage(
        result.notificationSent
          ? "LINEに連携解除の通知を送信しました。"
          : "連携を解除しましたが、LINEへの通知は送信できませんでした。",
      );
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsUnlinking(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        const accountIsLinked = await isLineAccountLinked();
        if (!isActive) return;
        setLinked(accountIsLinked);
        if (!accountIsLinked && !isLinked) await issueCode();
      } catch (error: unknown) {
        if (isActive) setErrorMessage(getErrorMessage(error));
      }
    })();

    return () => {
      isActive = false;
    };
  }, [isLinked, issueCode]);

  useEffect(() => {
    if (linked) return;

    let isActive = true;
    const intervalId = window.setInterval(() => {
      void isLineAccountLinked()
        .then((accountIsLinked) => {
          if (isActive && accountIsLinked) {
            setLinked(true);
            setOtp(null);
            setRemainingSeconds(0);
          }
        })
        .catch((error: unknown) => {
          if (isActive) setErrorMessage(getErrorMessage(error));
        });
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [linked]);

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

  if (linked) {
    return (
      <section className="rounded-3xl border-2 border-green-100 bg-white p-5 shadow-sm space-y-3">
        <div>
          <h2 className="font-extrabold text-gray-800">LINEアカウント連携済み</h2>
          <p className="mt-1 text-sm text-gray-500">LINEアカウントとの連携が完了しています。</p>
        </div>
        {errorMessage ? (
          <p className="text-sm font-bold text-rose-600" role="alert">{errorMessage}</p>
        ) : null}
        {statusMessage ? (
          <p className="text-sm font-bold text-teal-700" role="status">{statusMessage}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void unlinkAccount()}
          disabled={isUnlinking}
          className="w-full rounded-full border-2 border-rose-200 px-4 py-3 font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUnlinking ? "解除中..." : "LINE連携を解除"}
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border-2 border-green-100 bg-white p-5 shadow-sm space-y-3">
      <div>
        <h2 className="font-extrabold text-gray-800">LINEアカウント連携</h2>
        <p className="mt-1 text-sm text-gray-500">家計簿アカウントとLINEボットを連携します。</p>
      </div>

      <p className="text-sm font-bold text-gray-700">
        以下のワンタイムパスワードをLINEボット宛に5分以内に送信してください。
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
      {statusMessage ? (
        <p className="text-sm font-bold text-teal-700" role="status">
          {statusMessage}
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
