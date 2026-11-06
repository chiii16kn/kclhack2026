"use client";

import { useActionState, useState } from "react";
import {
  createCategory,
  type CreateCategoryState,
} from "@/app/actions/category";

const initialState: CreateCategoryState = { success: false, message: "" };

export default function CreateCategoryForm() {
  const [state, formAction, isPending] = useActionState(createCategory, initialState);
  const [expenseType, setExpenseType] = useState<"FIXED" | "VARIABLE">("VARIABLE");

  return (
    <section className="rounded-3xl border-2 border-teal-100 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-extrabold text-gray-800">カテゴリを追加</h3>
        <p className="mt-1 text-sm text-gray-500">Webから新しいカテゴリを登録できます。</p>
      </div>

      <form action={formAction} className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
          カテゴリ名
          <input
            name="name"
            type="text"
            maxLength={40}
            placeholder="例: 通信費"
            className="rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 focus:border-teal-300 focus:bg-white focus:outline-none"
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold text-gray-500">
          種類
          <select
            name="expenseType"
            value={expenseType}
            onChange={(event) =>
              setExpenseType(event.target.value === "FIXED" ? "FIXED" : "VARIABLE")
            }
            className="rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 focus:border-teal-300 focus:bg-white focus:outline-none"
          >
            <option value="VARIABLE">変動費</option>
            <option value="FIXED">固定費</option>
          </select>
        </label>

        {expenseType === "FIXED" ? (
          <label className="flex flex-col gap-1 text-xs font-bold text-gray-500 sm:col-span-2">
            月の予算（円）
            <input
              name="monthlyBudget"
              type="number"
              min={1}
              step={1}
              placeholder="例: 80000"
              className="rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 focus:border-teal-300 focus:bg-white focus:outline-none"
              required
            />
          </label>
        ) : null}

        {state.message ? (
          <p
            className={`text-sm font-bold sm:col-span-2 ${state.success ? "text-teal-700" : "text-rose-600"}`}
            role={state.success ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
        >
          {isPending ? "追加中..." : "カテゴリを追加"}
        </button>
      </form>
    </section>
  );
}
