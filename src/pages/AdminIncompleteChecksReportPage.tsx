import React, { useEffect, useState, useCallback, useMemo } from "react";
import { reportService } from "../services/reportService";
import type {
  IncompleteCheckReportDto,
  GetAttendancesParams,
  SemesterDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { normalizeNumberInput } from "../utils/numberUtils";
import { FaFileAlt } from "react-icons/fa";
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import { semesterService } from "../services/semesterService";

type FilterType = "unit" | "range";
type UnitType = "year" | "half" | "quarter" | "month" | "semester";

const AdminIncompleteChecksReportPage: React.FC = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<IncompleteCheckReportDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // 동명이인 판별용: 전체 멤버 (id, name, birthDate)
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  // 실제 학기 목록
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  const hasActiveSemesters = semesters.length > 0;

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    year: "" as number | "",
    month: "" as number | "",
    quarter: "" as number | "",
    half: "" as number | "",
    semesterId: "" as number | "",
  });
  const [filterType, setFilterType] = useState<FilterType>("unit");
  const [unitType, setUnitType] = useState<UnitType>("year");

  const yearOptions = useMemo(
    () =>
      availableYears.length === 0
        ? (() => {
            const cy = new Date().getFullYear();
            return [
              { value: "", label: "전체 연도" },
              { value: cy, label: `${cy}년` },
            ];
          })()
        : [
            { value: "", label: "전체 연도" },
            ...availableYears.map((year) => ({
              value: year,
              label: `${year}년`,
            })),
          ],
    [availableYears]
  );

  const handleFilterChange = (field: keyof typeof filters, value: any) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  // YYYY-MM-DD -> MM/DD로 변환
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [, month, day] = dateStr.split("-");
    return `${month}/${day}`;
  };

  // 필터 상태를 바탕으로 간단한 요약 문자열 생성
  const periodSummary = useMemo(() => {
    if (filterType === "range" && filters.startDate && filters.endDate) {
      return `기간: ${formatShortDate(filters.startDate)} ~ ${formatShortDate(
        filters.endDate
      )}`;
    }

    if (filterType === "unit") {
      // 학기 단위 요약
      if (unitType === "semester" && filters.semesterId && semesters.length) {
        const semester = semesters.find((s) => s.id === filters.semesterId);
        if (semester) {
          return `조회 단위: 학기 (${semester.name})`;
        }
      }

      const yearText = filters.year ? `${filters.year}년` : "전체 연도";
      if (unitType === "year") return `조회 단위: 연간 (${yearText})`;
      if (unitType === "half" && filters.half)
        return `조회 단위: ${yearText} ${
          filters.half === 1 ? "상반기" : "하반기"
        }`;
      if (unitType === "quarter" && filters.quarter)
        return `조회 단위: ${yearText} ${filters.quarter}분기`;
      if (unitType === "month" && filters.month)
        return `조회 단위: ${yearText} ${filters.month}월`;
    }

    return "";
  }, [filterType, unitType, filters, semesters]);

  /**
   * 상단 조회 단위 버튼 클릭 (연간 / 반기 / 분기 / 월간 / 학기)
   */
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    setFilters((prev) => {
      const currentYear =
        prev.year && typeof prev.year === "number"
          ? (prev.year as number)
          : new Date().getFullYear();

      const next = { ...prev };

      if (type === "year") {
        next.year = currentYear;
        next.month = "";
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "half") {
        next.year = currentYear;
        next.half = (next.half as number) || 1;
        next.month = "";
        next.quarter = "";
        next.semesterId = "";
      } else if (type === "quarter") {
        next.year = currentYear;
        next.quarter = (next.quarter as number) || 1;
        next.month = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "month") {
        next.year = currentYear;
        next.month = (next.month as number) || new Date().getMonth() + 1; // 1~12
        next.quarter = "";
        next.half = "";
        next.semesterId = "";
      } else if (type === "semester") {
        // 학기 모드: 연/월/분기/반기 초기화, 학기 선택만 사용
        next.year = "";
        next.month = "";
        next.quarter = "";
        next.half = "";
        // semesterId는 기존 선택 유지 가능
      }

      return next;
    });
  };

  /**
   * 월/분기/반기 세부 값 선택 버튼 (하단 버튼)
   */
  const handleUnitValueChange = (
    unit: "month" | "quarter" | "half",
    value: number
  ) => {
    setFilters((prev) => {
      const cy = new Date().getFullYear();
      const baseYear = prev.year || cy;

      return {
        ...prev,
        year: baseYear,
        month: unit === "month" ? value : "",
        quarter: unit === "quarter" ? value : "",
        half: unit === "half" ? value : "",
        semesterId: "", // 다른 단위를 선택하면 학기 선택 해제
      };
    });
  };

  // 학기 버튼 클릭
  const handleSemesterClick = (semesterId: number) => {
    setFilters((prev) => ({
      ...prev,
      semesterId,
      year: "",
      month: "",
      quarter: "",
      half: "",
    }));
  };

  const renderUnitButtons = () => {
    switch (unitType) {
      case "month":
        return (
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleUnitValueChange("month", m)}
                className={`px-2 py-1 border rounded-full text-xs ${
                  filters.month === m ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {m}월
              </button>
            ))}
          </div>
        );
      case "quarter":
        return (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 4 }, (_, i) => i + 1).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleUnitValueChange("quarter", q)}
                className={`px-2 py-1 border rounded-full text-sm ${
                  filters.quarter === q ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {q}분기
              </button>
            ))}
          </div>
        );
      case "half":
        return (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 2 }, (_, i) => i + 1).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => handleUnitValueChange("half", h)}
                className={`px-2 py-1 border rounded-full text-sm ${
                  filters.half === h ? "bg-blue-500 text-white" : "bg-white"
                }`}
              >
                {h === 1 ? "상반기" : "하반기"}
              </button>
            ))}
          </div>
        );
      case "semester":
        if (semesters.length === 0) {
          return (
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
              현재 활성 상태인 학기가 없습니다. 리포트에서 학기 선택을
              사용하려면 최소 1개 이상의 학기를 활성화해 주세요.
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {semesters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSemesterClick(s.id)}
                className={`px-2 py-1 border rounded-full text-sm ${
                  filters.semesterId === s.id
                    ? "bg-blue-500 text-white"
                    : "bg-white"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        );
      case "year":
      default:
        return null;
    }
  };

  const fetchIncompleteChecks = useCallback(
    async (opts?: { skipLoading?: boolean }) => {
      if (!user || user.role !== "EXECUTIVE") {
        setLoading(false);
        setError("접근 권한이 없습니다.");
        return;
      }

      if (!opts?.skipLoading) {
        setLoading(true);
      }
      setError(null);

      let params: GetAttendancesParams = {};

      if (filterType === "range") {
        params = {
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        };
      } else {
        // 단위 기반
        if (filters.semesterId && semesters.length > 0) {
          // 학기 선택 시: 학기 startDate/endDate 사용
          const semester = semesters.find((s) => s.id === filters.semesterId);
          if (semester) {
            params = {
              startDate: semester.startDate,
              endDate: semester.endDate,
            };
          }
        } else {
          // 기존 연/월/분기/반기 기반 조회
          params = {
            year: normalizeNumberInput(filters.year),
            month: normalizeNumberInput(filters.month),
            quarter: normalizeNumberInput(filters.quarter),
            half: normalizeNumberInput(filters.half),
          };
        }
      }

      const cleanedParams = Object.fromEntries(
        Object.entries(params).filter(
          ([, v]) => v !== null && v !== "" && v !== undefined
        )
      );

      try {
        const data = await reportService.getIncompleteCheckReport(
          cleanedParams
        );
        setReport(data);
      } catch (err: any) {
        console.error("Failed to fetch incomplete checks report:", err);
        setError(
          err?.response?.data?.message ||
            "출석 누락 현황 정보를 불러오는 데 실패했습니다."
        );
      } finally {
        if (!opts?.skipLoading) {
          setLoading(false);
        }
      }
    },
    [user, filters, filterType, semesters]
  );

  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await reportService.getAvailableYearsForReports();
      setAvailableYears(years);
    } catch (err) {
      console.error("Failed to fetch available years for reports:", err);
      setAvailableYears([]);
    }
  }, []);

  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("Failed to fetch semesters for reports:", err);
      setSemesters([]);
    }
  }, []);

  // 🔹 필터/단위 변경 시 리포트 재조회
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchIncompleteChecks();
  }, [user, fetchIncompleteChecks]);

  // 🔹 연도/학기 목록은 EXECUTIVE 확정 시 한 번
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;
    fetchAvailableYears();
    fetchSemesters();
  }, [user, fetchAvailableYears, fetchSemesters]);

  // 🔹 동명이인 판별용 전체 멤버 정보 로딩
  useEffect(() => {
    if (!user || user.role !== "EXECUTIVE") return;

    const fetchAllMembersForNameCheck = async () => {
      try {
        const page = await memberService.getAllMembers({
          page: 0,
          size: 1000,
          sort: "id,asc",
        });

        const list =
          page?.content?.map((m) => ({
            id: m.id,
            name: m.name,
            birthDate: m.birthDate,
          })) ?? [];

        setAllMembersForNameCheck(list);
      } catch (e) {
        console.error("동명이인 판별용 멤버 목록 로딩 실패:", e);
        setAllMembersForNameCheck([]);
      }
    };

    fetchAllMembersForNameCheck();
  }, [user]);

  if (!user || user.role !== "EXECUTIVE") {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <p className="mt-4 text-red-600">이 페이지에 접근할 권한이 없습니다.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
          <p className="text-sm text-gray-500">
            리포트 정보를 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md w-full text-center">
          <p className="text-red-700 mb-3">{error}</p>
          <button
            type="button"
            onClick={() => fetchIncompleteChecks({ skipLoading: false })}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">출석 누락 현황</h1>
          <p className="mt-1 text-sm text-gray-600">
            지정된 기간 동안 출석 체크를 완료하지 않은 셀장 및 날짜 정보.
          </p>
        </div>
      </div>

      {/* 필터 영역 */}
      <div className="p-4 bg-gray-50 rounded-lg mb-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">기간 설정</h3>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setFilterType("unit")}
              className={`px-3 py-1 text-sm rounded-full ${
                filterType === "unit"
                  ? "bg-blue-500 text-white"
                  : "bg-white border"
              }`}
            >
              단위로 조회
            </button>
            <button
              type="button"
              onClick={() => setFilterType("range")}
              className={`px-3 py-1 text-sm rounded-full ${
                filterType === "range"
                  ? "bg-blue-500 text-white"
                  : "bg-white border"
              }`}
            >
              기간으로 조회
            </button>
          </div>
        </div>

        {filterType === "range" ? (
          // 기간 직접 설정
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                기간 시작
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                기간 종료
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
              />
            </div>
          </div>
        ) : (
          // 단위 기반 설정
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  연도
                </label>
                <select
                  value={filters.year}
                  onChange={(e) =>
                    handleFilterChange(
                      "year",
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm h-[42px] px-3"
                  disabled={unitType === "semester"}
                >
                  {yearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {unitType === "semester" && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    학기 단위 조회 시 연도를 선택할 수 없습니다.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  조회 단위
                </label>
                <div className="flex items-center space-x-2 mt-1">
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("year")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "year"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    연간
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("half")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "half"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    반기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("quarter")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "quarter"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    분기
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitTypeClick("month")}
                    className={`px-3 py-1 text-sm rounded-full ${
                      unitType === "month"
                        ? "bg-blue-500 text-white"
                        : "bg-white border"
                    }`}
                  >
                    월간
                  </button>
                  {/* 🔽 학기 버튼만 스타일을 확실히 다르게 */}
                  <button
                    type="button"
                    onClick={() =>
                      hasActiveSemesters && handleUnitTypeClick("semester")
                    }
                    disabled={!hasActiveSemesters}
                    className={`px-3 py-1 text-sm rounded-full border ${
                      hasActiveSemesters
                        ? unitType === "semester"
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white"
                        : "bg-gray-100 text-gray-400 border-dashed cursor-not-allowed"
                    }`}
                  >
                    학기
                  </button>
                </div>

                {/* 🔽 버튼 바로 아래 안내문 한 줄 추가 (활성 학기 없을 때만) */}
                {!hasActiveSemesters && (
                  <p className="mt-1 text-xs text-red-500">
                    활성화된 학기가 없어 학기 단위 조회를 사용할 수 없습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 월/분기/반기/학기 세부 선택 버튼 */}
            {renderUnitButtons()}
          </div>
        )}
      </div>

      {/* 기간 요약 한 줄 */}
      {periodSummary && (
        <p className="mb-3 text-xs text-gray-500">{periodSummary}</p>
      )}

      {/* 결과 테이블 */}
      {report.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow-md text-center text-gray-500">
          <FaFileAlt className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <p className="text-lg font-semibold">
            조건에 맞는 미완료 출석 체크가 없습니다.
          </p>
          <p className="text-sm">기간 필터를 조정해 보세요.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  셀장 이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  셀 이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  미완료 횟수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  미완료 날짜
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {report.map((item) => (
                <tr key={item.leaderId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {(() => {
                      const leaderMember = allMembersForNameCheck.find(
                        (m) => m.id === item.leaderId
                      );
                      return leaderMember
                        ? formatDisplayName(
                            leaderMember,
                            allMembersForNameCheck
                          )
                        : item.leaderName;
                    })()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.cellName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`
                        inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                        ${
                          item.missedDatesCount >= 5
                            ? "bg-red-100 text-red-700"
                            : item.missedDatesCount >= 2
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                        }
                      `}
                    >
                      {item.missedDatesCount}회
                    </span>
                  </td>
                  <td className="px-6 py-4 align-top text-sm text-gray-500">
                    <div className="max-h-32 overflow-y-auto pr-1">
                      <ul className="space-y-1">
                        {item.missedDates.map((date, index) => (
                          <li
                            key={`${date}-${index}`}
                            className="flex items-center text-xs text-gray-700"
                          >
                            <span className="mr-1 text-gray-500">ㅇ</span>
                            <span>{formatShortDate(date)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminIncompleteChecksReportPage;
