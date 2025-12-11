import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

interface PaginationProps {
  currentPage: number; // 0-based
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  itemLabel?: string; // 예: '개', '건', '명' 등
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalElements,
  onPageChange,
  itemLabel = "개",
}) => {
  // 페이지가 1페이지뿐이면 숫자 바는 굳이 표시하지 않음
  if (totalPages <= 1) {
    return (
      <div className="mt-4 flex items-center justify-end px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700">
        총 <span className="ml-1 font-medium">{totalElements}</span>
        {itemLabel}
      </div>
    );
  }

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  const safeOnPageChange = (page: number) => {
    if (page < 0 || page > totalPages - 1) return;
    onPageChange(page);
  };

  // 숫자 버튼 계산 로직
  const pageNumbers: number[] = [];
  const pageLimit = 5; // 최대 5개 버튼
  let startPage = Math.max(0, currentPage - Math.floor(pageLimit / 2));
  let endPage = startPage + pageLimit - 1;

  if (endPage >= totalPages) {
    endPage = totalPages - 1;
    startPage = Math.max(0, endPage - pageLimit + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="border-t border-gray-200 bg-white px-3 sm:px-6 py-2 sm:py-3 mt-4">
      {/* 작은 화면에서는 위아래, 큰 화면에서는 좌우 배치 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        {/* 개수 / 페이지 정보 */}
        <p className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
          총 <span className="font-medium">{totalElements}</span>
          {itemLabel} · <span className="font-medium">{currentPage + 1}</span> /{" "}
          <span className="font-medium">{totalPages}</span> 페이지
        </p>

        {/* 숫자 페이지 바: 작은 화면에서는 가로 스크롤 허용 */}
        <div className="overflow-x-auto sm:flex sm:justify-end">
          <nav
            className="isolate inline-flex -space-x-px rounded-md shadow-sm"
            aria-label="페이지 네비게이션"
          >
            {/* 이전 버튼 */}
            <button
              onClick={() => safeOnPageChange(currentPage - 1)}
              disabled={isFirstPage}
              className="relative inline-flex items-center rounded-l-md px-2.5 py-2.5 sm:px-2 sm:py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">이전 페이지</span>
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* 처음 페이지로 점프 */}
            {startPage > 0 && (
              <>
                <button
                  onClick={() => safeOnPageChange(0)}
                  className={`relative inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold ${
                    currentPage === 0
                      ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  }`}
                >
                  1
                </button>
                {startPage > 1 && (
                  <span className="relative inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                    …
                  </span>
                )}
              </>
            )}

            {/* 현재 주변 페이지 번호들 */}
            {pageNumbers.map((number) => (
              <button
                key={number}
                onClick={() => safeOnPageChange(number)}
                aria-current={currentPage === number ? "page" : undefined}
                className={`relative inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold ${
                  currentPage === number
                    ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                    : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                }`}
              >
                {number + 1}
              </button>
            ))}

            {/* 마지막 페이지로 점프 */}
            {endPage < totalPages - 1 && (
              <>
                {endPage < totalPages - 2 && (
                  <span className="relative inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300">
                    …
                  </span>
                )}
                <button
                  onClick={() => safeOnPageChange(totalPages - 1)}
                  className={`relative inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold ${
                    currentPage === totalPages - 1
                      ? "z-10 bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      : "text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {totalPages}
                </button>
              </>
            )}

            {/* 다음 버튼 */}
            <button
              onClick={() => safeOnPageChange(currentPage + 1)}
              disabled={isLastPage}
              className="relative inline-flex items-center rounded-r-md px-2.5 py-2.5 sm:px-2 sm:py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">다음 페이지</span>
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;
