// src/components/CategorySettingsModal.tsx
"use client";

import { useState } from "react";
import { updateCategorySettings } from "@/app/actions/category";

type Category = {
  id: string;
  name: string;
  countType: string;
  countValue: number;
  mergeSameDay: boolean;
};

export default function CategorySettingsModal({
  category,
  onClose,
}: {
  category: Category;
  onClose: () => void;
}) {
  const [countType, setCountType] = useState(category.countType);
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="bg-gray-100 p-4 flex justify-between items-center">
          <h2 className="font-extrabold text-gray-700 flex items-center gap-2 text-lg">
            ⚙️ {category.name} の設定
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white rounded-full hover:bg-gray-200 transition font-bold text-gray-500">×</button>
        </div>
        
        <form 
          action={async (formData) => {
            setIsProcessing(true);
            await updateCategorySettings(formData);
            setIsProcessing(false);
            onClose();
          }} 
          className="p-6 space-y-5"
        >
          <input type="hidden" name="categoryId" value={category.id} />

          {/* 計算方法の選択 */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-600 block">1日/1回の計算方法</label>
            <div className="grid grid-cols-2 gap-2">
              <label className={`border-2 rounded-xl p-3 text-center cursor-pointer transition ${countType === 'DAILY' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <input type="radio" name="countType" value="DAILY" checked={countType === 'DAILY'} onChange={() => setCountType('DAILY')} className="hidden" />
                <span className="text-sm font-bold block">カレンダーの日数割</span>
              </label>
              <label className={`border-2 rounded-xl p-3 text-center cursor-pointer transition ${countType === 'MONTHLY_COUNT' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                <input type="radio" name="countType" value="MONTHLY_COUNT" checked={countType === 'MONTHLY_COUNT'} onChange={() => setCountType('MONTHLY_COUNT')} className="hidden" />
                <span className="text-sm font-bold block">目標の回数割</span>
              </label>
            </div>
          </div>

          {/* 回数指定（回数割のときだけ表示） */}
          {countType === 'MONTHLY_COUNT' && (
            <div className="space-y-2 bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <label className="text-sm font-bold text-blue-700 block">1ヶ月に何回使う予定？</label>
              <div className="flex items-center gap-2">
                <input type="number" name="countValue" defaultValue={category.countValue} min="1" max="100" className="w-full px-4 py-2 border-2 border-white rounded-xl text-right font-bold focus:outline-none focus:border-blue-300" required />
                <span className="text-sm font-bold text-blue-600">回</span>
              </div>
            </div>
          )}
          {countType === 'DAILY' && (
            <input type="hidden" name="countValue" value="30" />
          )}

          {/* 同日まとめ設定 */}
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border-2 border-gray-100 rounded-xl cursor-pointer hover:bg-gray-50 transition">
              <input type="checkbox" name="mergeSameDay" value="true" defaultChecked={category.mergeSameDay} className="w-5 h-5 accent-blue-500 rounded" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-700">同じ日の支出を1回にまとめる</span>
                <span className="text-[10px] text-gray-400">スーパーを何回ハシゴしても1回扱いになります</span>
              </div>
            </label>
          </div>

          <button type="submit" disabled={isProcessing} className="w-full py-3 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-700 transition active:scale-95 disabled:opacity-50 mt-4">
            設定を保存する
          </button>
        </form>
      </div>
    </div>
  );
}