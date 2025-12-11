import React from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      {/* ✅ px-4 : 모바일 좌우 여백 확보 */}
      <div
        role="dialog"
        aria-modal="true"
        className="
          w-full
          max-w-sm
          bg-white
          rounded-lg
          shadow-xl
          p-4
          sm:p-6
        "
      >
        {/* 제목 */}
        <h3 className="text-base sm:text-lg font-bold text-gray-900">
          {title}
        </h3>

        {/* 메시지 */}
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">{message}</p>

        {/* 버튼 영역 */}
        <div
          className="
            mt-6
            flex
            flex-col-reverse
            gap-2
            sm:flex-row
            sm:justify-end
            sm:gap-3
          "
        >
          {/* ✅ 모바일: 취소/확인 세로 스택
              ✅ sm 이상: 가로 정렬 */}
          <button
            onClick={onClose}
            className="
              w-full
              sm:w-auto
              px-4
              py-2
              text-sm
              font-medium
              text-gray-700
              bg-gray-100
              rounded-md
              hover:bg-gray-200
              focus:outline-none
              focus:ring-2
              focus:ring-offset-2
              focus:ring-gray-400
            "
          >
            취소
          </button>

          <button
            onClick={onConfirm}
            className="
              w-full
              sm:w-auto
              px-4
              py-2
              text-sm
              font-medium
              text-white
              bg-red-600
              rounded-md
              hover:bg-red-700
              focus:outline-none
              focus:ring-2
              focus:ring-offset-2
              focus:ring-red-500
            "
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
