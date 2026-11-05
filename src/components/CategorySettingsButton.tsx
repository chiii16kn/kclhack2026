// src/components/CategorySettingsButton.tsx
"use client";

import { useState } from "react";
import CategorySettingsModal from "./CategorySettingsModal";

type Category = {
  id: string;
  name: string;
  countType: string;
  countValue: number;
  mergeSameDay: boolean;
};

export default function CategorySettingsButton({ category }: { category: Category }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full hover:bg-gray-100 transition text-sm shadow-sm border border-gray-200"
        title="カテゴリ設定"
      >
        ⚙️
      </button>

      {isOpen && (
        <CategorySettingsModal 
          category={category} 
          onClose={() => setIsOpen(false)} 
        />
      )}
    </>
  );
}