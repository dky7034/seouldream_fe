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
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">{title}</h3>
      </div>
      <div className="border-t border-gray-200 p-6 space-y-4">
        {onExportMembers && (
          <div>
            <button
              onClick={onExportMembers}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              {memberButtonLabel}
            </button>
          </div>
        )}

        {onExportAttendances && (
          <>
            <p className="text-sm font-medium text-gray-700 pt-2 border-t">
              출석 현황 다운로드 기간
            </p>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => onChangeStartDate(e.target.value)}
                className="p-2 border rounded-md w-full"
              />
              <span>~</span>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => onChangeEndDate(e.target.value)}
                className="p-2 border rounded-md w-full"
              />
            </div>
            <button
              onClick={onExportAttendances}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 mt-2"
            >
              출석 현황 다운로드
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ExportCard;
