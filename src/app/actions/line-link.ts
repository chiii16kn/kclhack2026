"use server";

import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function isLineAccountLinked(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error("ログイン状態を確認できませんでした。");
  if (!user) throw new Error("LINE連携状態を確認するにはログインしてください。");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { lineId: true },
  });
  if (!account) throw new Error("家計簿アカウントが見つかりません。");

  return account.lineId !== null;
}

export async function issueLineLinkOtp(): Promise<{
  code: string;
  expiresAt: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error("ログイン状態を確認できませんでした。");
  if (!user) throw new Error("LINE連携コードを発行するにはログインしてください。");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, lineId: true },
  });
  if (!account) throw new Error("家計簿アカウントが見つかりません。");
  if (account.lineId) {
    throw new Error("このアカウントはすでにLINE連携済みです。");
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.otpCode.deleteMany({ where: { userId: account.id } });
        await tx.otpCode.create({
          data: {
            code,
            userId: account.id,
            expiresAt,
          },
        });
      });

      return { code, expiresAt: expiresAt.toISOString() };
    } catch (error: unknown) {
      if (!isUniqueConstraintError(error) || attempt === 4) throw error;
    }
  }

  throw new Error("連携コードを発行できませんでした。もう一度お試しください。");
}
