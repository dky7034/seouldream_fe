// src/components/AlertModal.tsx
import React from "react";

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm bg-white rounded-lg shadow-xl p-4 sm:p-6"
      >
        <h3 className="text-base sm:text-lg font-bold text-gray-900">
          {title}
        </h3>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{message}</p>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
