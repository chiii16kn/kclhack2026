"use client";

import { useState } from "react";
import { deleteTransaction } from "@/app/actions/transaction";

export default function DeleteTransactionButton({
  transactionId,
  label,
}: {
  transactionId: string;
  label: string;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <form
      action={async (formData) => {
        if (!window.confirm(`${label} を削除しますか？`)) return;
        setIsDeleting(true);
        try {
          await deleteTransaction(formData);
        } finally {
          setIsDeleting(false);
        }
      }}
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <button
        type="submit"
        disabled={isDeleting}
        aria-label={`${label} を削除`}
        className="shrink-0 whitespace-nowrap px-3 py-1 text-xs font-bold text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition disabled:opacity-50"
      >
        削除
      </button>
    </form>
  );
}
