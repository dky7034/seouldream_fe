// src/components/attendance/ConfirmationModal.tsx
import React, { useEffect } from "react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  children: React.ReactNode;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  children,
}) => {
  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // 모달 열려 있을 때 뒤 배경 스크롤 잠금 (모바일에서 특히 중요)
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-40 px-3 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      aria-describedby="confirmation-modal-body"
      onClick={handleBackdropClick}
    >
      <div
        className="
          w-full max-w-lg bg-white 
          rounded-t-2xl sm:rounded-2xl 
          shadow-xl overflow-hidden
          transform transition-all
        "
      >
        {/* 헤더 */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
          <h2
            id="confirmation-modal-title"
            className="text-base sm:text-lg font-semibold text-gray-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="ml-3 inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div
          id="confirmation-modal-body"
          className="px-4 sm:px-6 py-4 max-h-[60vh] overflow-y-auto text-sm sm:text-base text-gray-800"
        >
          {children}
        </div>

        {/* 버튼 영역 */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto inline-flex justify-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 min-h-[40px]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto inline-flex justify-center px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500 min-h-[40px]"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
