// src/components/ExportCard.tsx
import React from "react";

interface ExportCardProps {
  title?: string;
  memberButtonLabel?: string;
  onExportMembers?: () => void;
  onExportAttendances?: () => void;
  exportStartDate: string;
  exportEndDate: string;
  onChangeStartDate: (value: string) => void;
  onChangeEndDate: (value: string) => void;
}

const ExportCard: React.FC<ExportCardProps> = ({
  title = "데이터 추출 (xlsx)",
  memberButtonLabel = "멤버 명단 다운로드",
  onExportMembers,
  onExportAttendances,
  exportStartDate,
  exportEndDate,
  onChangeStartDate,
  onChangeEndDate,
}) => {
  return (
    <div className="bg-white shadow rounded-lg sm:rounded-lg overflow-hidden">
      {/* 헤더 */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-100">
        <h3 className="text-sm sm:text-lg leading-6 font-semibold text-gray-900">
          {title}
        </h3>
      </div>

      {/* 내용 */}
      <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-4">
        {onExportMembers && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-medium text-gray-700">
              멤버 명단
            </p>
            <button
              type="button"
              onClick={onExportMembers}
              className="w-full px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 min-h-[40px]"
            >
              {memberButtonLabel}
            </button>
          </div>
        )}

        {onExportAttendances && (
          <div className="pt-3 border-t border-gray-200 space-y-3">
            <p className="text-xs sm:text-sm font-medium text-gray-700">
              출석 현황 다운로드 기간
            </p>

            {/* 날짜 입력 - 모바일: 세로, sm 이상: 가로 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
              <div className="w-full">
                <label className="block text-[11px] sm:text-xs text-gray-500 mb-1">
                  시작일
                </label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => onChangeStartDate(e.target.value)}
                  className="block w-full h-[40px] px-3 text-xs sm:text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* 데스크톱에서만 가운데 ~ 표시 */}
              <div className="hidden sm:flex items-end pb-2 justify-center text-gray-500">
                ~
              </div>

              <div className="w-full">
                <label className="block text-[11px] sm:text-xs text-gray-500 mb-1">
                  종료일
                </label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => onChangeEndDate(e.target.value)}
                  className="block w-full h-[40px] px-3 text-xs sm:text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 공통 안내 문구: 모바일/데스크톱 모두 살짝 보이게 */}
            <p className="text-[11px] sm:text-xs text-gray-500">
              선택한 기간을 기준으로 출석 현황 엑셀 파일이 생성됩니다.
            </p>

            <button
              type="button"
              onClick={onExportAttendances}
              className="w-full mt-1 px-4 py-2.5 text-xs sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 min-h-[40px]"
            >
              출석 현황 다운로드
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExportCard;
