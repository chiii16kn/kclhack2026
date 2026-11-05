// src/components/ActionRequiredModal.tsx
"use client";

import { useState } from "react";
import { resolveDeficit, quickAllocate } from "@/app/actions/resolve";

type Category = { id: string; name: string; remaining: number };
type SimpleCategory = { id: string; name: string };

function AllocateAmountInput({ amount }: { amount: number }) {
  const [allocateAmount, setAllocateAmount] = useState(amount);

  return (
    <input
      type="number"
      name="amount"
      value={allocateAmount}
      onChange={(event) => setAllocateAmount(Number(event.target.value))}
      className="w-24 px-3 py-2.5 border-2 border-gray-100 rounded-xl text-sm text-right font-bold bg-gray-50 focus:outline-none focus:border-orange-200"
      required
    />
  );
}

export default function ActionRequiredModal({
  unallocatedAmount,
  overCategories,
  allCategories,
  currentYearMonth,
}: {
  unallocatedAmount: number;
  overCategories: Category[];
  allCategories: SimpleCategory[];
  currentYearMonth: string;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#FFFBF0] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border-2 border-orange-100 animate-in fade-in zoom-in duration-200">
        <div className="bg-orange-400 p-4 text-white flex justify-between items-center">
          <h2 className="font-extrabold flex items-center gap-2 text-lg">
            <span>⚠️</span> お金の整理が必要です
          </h2>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition font-bold">×</button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* 赤字解決セクション */}
          {overCategories.length > 0 && (
            <div className="space-y-3 bg-white p-5 rounded-2xl border border-rose-100 shadow-sm">
              <h3 className="font-bold text-rose-600 flex items-center gap-2">🚨 赤字の袋を解決する</h3>
              <ul className="space-y-3">
                {overCategories.map(cat => {
                  const deficit = Math.abs(cat.remaining);
                  const canCover = unallocatedAmount >= deficit;
                  return (
                    <li key={cat.id} className="flex flex-col gap-2 bg-rose-50 p-3 rounded-xl border border-rose-100">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-800">{cat.name}</span>
                        <strong className="text-rose-600">¥{deficit.toLocaleString()} オーバー</strong>
                      </div>
                      {canCover ? (
                        <button
                          disabled={isProcessing}
                          onClick={async () => {
                            setIsProcessing(true);
                            await resolveDeficit(cat.id, deficit, currentYearMonth);
                            setIsProcessing(false);
                          }}
                          className="w-full py-2 bg-rose-400 text-white rounded-xl text-sm font-bold hover:bg-rose-500 transition active:scale-95 disabled:opacity-50"
                        >
                          未配分から ¥{deficit.toLocaleString()} を支払う
                        </button>
                      ) : (
                        <p className="text-xs text-rose-500 font-bold text-center bg-white py-1.5 rounded-lg border border-rose-100">
                          未配分のお金が足りません（他を減らしてね）
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 未配分の一括割り当てセクション */}
          {unallocatedAmount > 0 && (
            <div className="space-y-3 bg-white p-5 rounded-2xl border border-yellow-100 shadow-sm">
              <div className="flex justify-between items-end">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">💰 未配分を分ける</h3>
                <span className="text-sm font-bold text-orange-600">残り: ¥{unallocatedAmount.toLocaleString()}</span>
              </div>
              
              <form action={async (formData) => {
                setIsProcessing(true);
                await quickAllocate(formData);
                setIsProcessing(false);
              }} className="flex flex-col gap-2">
                <input type="hidden" name="yearMonth" value={currentYearMonth} />
                <div className="flex gap-2">
                  <select name="categoryId" className="flex-1 px-3 py-2.5 border-2 border-gray-100 rounded-xl text-sm bg-gray-50 font-bold focus:outline-none focus:border-orange-200" required>
                    <option value="">どの袋に入れる？</option>
                    {allCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <AllocateAmountInput key={unallocatedAmount} amount={unallocatedAmount} />
                </div>
                <button type="submit" disabled={isProcessing} className="w-full py-2.5 bg-orange-400 text-white rounded-xl text-sm font-bold hover:bg-orange-500 transition active:scale-95 disabled:opacity-50">
                  この袋に入れる！
                </button>
              </form>
            </div>
          )}
          
          <div className="pt-2 flex justify-end">
            <button onClick={() => setIsOpen(false)} className="px-5 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition">今は時間がない</button>
          </div>
        </div>
      </div>
    </div>
  );
}