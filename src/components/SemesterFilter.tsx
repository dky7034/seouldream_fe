// src/components/SemesterFilter.tsx
import React, { useState, useEffect, useCallback } from "react";
import { semesterService } from "../services/semesterService";
import type { SemesterDto } from "../types";

interface SemesterFilterProps {
  onDateRangeChange: (startDate: string | null, endDate: string | null) => void;
}

const SemesterFilter: React.FC<SemesterFilterProps> = ({
  onDateRangeChange,
}) => {
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);

  const fetchSemesters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await semesterService.getAllSemesters();
      setSemesters(data);
      // Set active semester as default if it exists
      const activeSemester = data.find((s) => s.isActive);
      if (activeSemester) {
        setSelectedSemesterId(activeSemester.id);
        onDateRangeChange(activeSemester.startDate, activeSemester.endDate);
      } else {
        onDateRangeChange(null, null);
      }
    } catch (err) {
      console.error("Failed to fetch semesters:", err);
      onDateRangeChange(null, null);
    } finally {
      setLoading(false);
    }
  }, [onDateRangeChange]);

  useEffect(() => {
    fetchSemesters();
  }, [fetchSemesters]);

  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value === "" ? "" : Number(e.target.value);
    setSelectedSemesterId(newId);

    if (newId === "") {
      onDateRangeChange(null, null);
    } else {
      const selected = semesters.find((s) => s.id === newId);
      if (selected) {
        onDateRangeChange(selected.startDate, selected.endDate);
      }
    }
  };

  const handleActiveSemesterClick = () => {
    const activeSemester = semesters.find((s) => s.isActive);
    if (activeSemester) {
      setSelectedSemesterId(activeSemester.id);
      onDateRangeChange(activeSemester.startDate, activeSemester.endDate);
    }
  };
  
  const handleAllPeriodClick = () => {
    setSelectedSemesterId("");
    onDateRangeChange(null, null);
  };

  if (loading) {
    return <p className="text-sm text-gray-500">학기 정보 로딩 중...</p>;
  }

  return (
    <div className="flex items-center space-x-4">
      <button
        type="button"
        onClick={handleAllPeriodClick}
        className={`px-3 py-1.5 text-sm rounded-md border ${selectedSemesterId === "" ? "bg-indigo-600 text-white" : "bg-white"}`}
      >
        전체 기간
      </button>
      <button
        type="button"
        onClick={handleActiveSemesterClick}
        className="px-3 py-1.5 text-sm rounded-md border bg-white"
      >
        활성 학기
      </button>
      <select
        value={selectedSemesterId}
        onChange={handleSemesterChange}
        className="block w-full max-w-xs border-gray-300 rounded-md shadow-sm h-[42px] px-3"
      >
        <option value="" disabled>
          학기 선택...
        </option>
        {semesters.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({s.startDate} ~ {s.endDate})
          </option>
        ))}
      </select>
    </div>
  );
};

export default SemesterFilter;
