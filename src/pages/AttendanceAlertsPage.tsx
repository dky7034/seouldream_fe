// src/pages/AttendanceAlertsPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { semesterService } from "../services/semesterService";
import { useAuth } from "../hooks/useAuth";
import { formatDisplayName } from "../utils/memberUtils";
import type {
  MemberAlertDto,
  SemesterDto,
  GetAttendanceAlertsParams,
} from "../types";

type UnitType = "semester" | "year";

const AttendanceAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- 상태 관리 ---
  const [alerts, setAlerts] = useState<MemberAlertDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 동명이인 판별용 멤버 리스트
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  // 연속 결석 횟수 (기본값 3)
  const [consecutiveAbsences, setConsecutiveAbsences] = useState<string>("3");

  // 필터 상태
  const [unitType, setUnitType] = useState<UnitType>("semester");
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);

  // ✅ [추가] 서버에서 받아올 '데이터가 존재하는 연도' 목록
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // 선택된 연도 / 학기 ID
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | "">("");

  // 학기 자동 선택 완료 여부 플래그
  const [hasAutoSelectedSemester, setHasAutoSelectedSemester] = useState(false);

  // --- 날짜 포맷팅 함수 ---
  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    const targetStr =
      dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;
    const date = new Date(targetStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  // --- 데이터 로딩 (학기, 연도, 멤버) ---

  // 1. 학기 목록
  const fetchSemesters = useCallback(async () => {
    try {
      const data = await semesterService.getAllSemesters(true);
      setSemesters(data);
    } catch (err) {
      console.error("학기 목록 로딩 실패:", err);
    }
  }, []);

  // ✅ 2. [추가] 연도 목록 (데이터가 있는 연도만)
  const fetchAvailableYears = useCallback(async () => {
    try {
      const years = await attendanceService.getAvailableYears();
      setAvailableYears(years);
    } catch (err) {
      console.error("연도 목록 로딩 실패:", err);
      // 실패 시 현재 연도라도 넣어둠
      setAvailableYears([new Date().getFullYear()]);
    }
  }, []);

  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchSemesters();
      fetchAvailableYears(); // 연도 로딩 호출

      memberService
        .getAllMembers({ page: 0, size: 2000, sort: "id,asc" })
        .then((page) => {
          setAllMembersForNameCheck(
            page.content.map((m) => ({
              id: m.id,
              name: m.name,
              birthDate: m.birthDate,
            }))
          );
        })
        .catch((e) => console.error("멤버 목록 로딩 실패:", e));
    }
  }, [user, fetchSemesters, fetchAvailableYears]);

  // --- 스마트 학기 자동 선택 로직 ---
  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, "0")}`;

      let targetSemester = semesters.find((s) => {
        const start = s.startDate.substring(0, 7);
        const end = s.endDate.substring(0, 7);
        return currentYearMonth >= start && currentYearMonth <= end;
      });

      if (!targetSemester) {
        const sorted = [...semesters].sort((a, b) => b.id - a.id);
        targetSemester = sorted[0];
      }

      if (targetSemester) {
        setUnitType("semester");
        setSelectedSemesterId(targetSemester.id);
      } else {
        setUnitType("year");
        setSelectedYear(now.getFullYear());
      }
      setHasAutoSelectedSemester(true);
    } else if (
      semesters.length === 0 &&
      !hasAutoSelectedSemester &&
      selectedYear
    ) {
      // 학기가 없을 경우 연도 모드로 fallback
    }
  }, [semesters, hasAutoSelectedSemester, selectedYear]);

  // --- 출석 경고 목록 조회 (API 호출) ---
  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const threshold = Math.max(1, Number(consecutiveAbsences) || 1);

    try {
      const params: GetAttendanceAlertsParams = {
        consecutiveAbsences: threshold,
      };

      if (unitType === "year") {
        params.year = selectedYear;
      } else if (unitType === "semester" && selectedSemesterId) {
        params.semesterId = selectedSemesterId;
      }

      const data = await attendanceService.getAttendanceAlerts(params);
      setAlerts(data);
    } catch (err) {
      console.error("출석 경고 목록 로딩 실패:", err);
      setError("출석 경고 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [user, consecutiveAbsences, unitType, selectedYear, selectedSemesterId]);

  // --- 조회 실행 트리거 ---
  useEffect(() => {
    const isReady =
      hasAutoSelectedSemester ||
      (semesters.length === 0 && unitType === "year");

    if (isReady) {
      if (unitType === "semester" && !selectedSemesterId) return;
      void fetchAlerts();
    }
  }, [
    fetchAlerts,
    hasAutoSelectedSemester,
    semesters.length,
    unitType,
    selectedSemesterId,
    selectedYear,
  ]);

  // --- 핸들러 ---
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    if (type === "year") {
      // 연도 모드 진입 시, 선택된 연도가 없거나 목록에 없으면 가장 최신 연도 선택
      if (!selectedYear) {
        const latest =
          availableYears.length > 0
            ? availableYears[0]
            : new Date().getFullYear();
        setSelectedYear(latest);
      }
    }
  };

  const handleSearchClick = () => {
    void fetchAlerts();
  };

  const handleBlur = () => {
    const value = Number(consecutiveAbsences);
    if (Number.isNaN(value) || value < 1) {
      setConsecutiveAbsences("3");
    }
  };

  // ✅ [수정] 연도 옵션 생성: 서버 데이터 기반
  const yearOptions = useMemo(() => {
    // 데이터가 아직 안 왔거나 비어있으면 현재 연도라도 하나 보여줌
    if (availableYears.length === 0) {
      const curr = new Date().getFullYear();
      return [{ value: curr, label: `${curr}년` }];
    }
    // 받아온 연도 목록 매핑
    return availableYears.map((y) => ({
      value: y,
      label: `${y}년`,
    }));
  }, [availableYears]);

  // --- UI 렌더링 ---
  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 text-sm sm:text-base">
            페이지 접근 권한이 없습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            결석 관리
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            설정한 기간 동안 특정 횟수 이상 연속으로 결석한 멤버를 확인하고
            관리합니다.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-5 mb-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                조회 단위
              </label>
              <div className="inline-flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleUnitTypeClick("semester")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    unitType === "semester"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  학기별
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitTypeClick("year")}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
                    unitType === "year"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  연도별
                </button>
              </div>
            </div>

            <div className="flex-grow">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {unitType === "semester" ? "학기 선택" : "연도 선택"}
              </label>

              {unitType === "semester" ? (
                <div className="flex flex-wrap gap-2">
                  {semesters.length === 0 ? (
                    <span className="text-sm text-gray-400 py-2">
                      등록된 학기가 없습니다.
                    </span>
                  ) : (
                    semesters.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSemesterId(s.id)}
                        className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-colors ${
                          selectedSemesterId === s.id
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {s.name}
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="block w-full sm:w-48 pl-3 pr-10 py-2 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                >
                  {yearOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <hr className="border-gray-100" />

          <div>
            <label
              htmlFor="consecutiveAbsences"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              연속 결석 기준 (회)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="consecutiveAbsences"
                type="number"
                min={1}
                value={consecutiveAbsences}
                onChange={(e) => setConsecutiveAbsences(e.target.value)}
                onBlur={handleBlur}
                className="block w-24 sm:w-32 px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleSearchClick}
                disabled={loading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                  loading
                    ? "bg-indigo-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                }`}
              >
                {loading ? "조회 중..." : "조회하기"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              선택한 기간 내에 해당 횟수 이상 연속으로 결석한 기록이 있는 멤버를
              조회합니다.
            </p>
          </div>
        </div>

        {!loading && (
          <>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs sm:text-sm text-gray-700 font-medium">
                총 {alerts.length}명 발견됨
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {alerts.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                  <p className="text-gray-500 text-sm">
                    조건에 해당하는 결석자가 없습니다.
                  </p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const foundMember = allMembersForNameCheck.find(
                    (m) => m.id === alert.memberId
                  );
                  const displayName = foundMember
                    ? formatDisplayName(foundMember, allMembersForNameCheck)
                    : alert.memberName;

                  return (
                    <div
                      key={alert.memberId}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${alert.memberId}`)
                            }
                            className="text-sm font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            {displayName}
                          </button>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {alert.cellName || "소속 셀 없음"}
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {alert.consecutiveAbsences}회 연속
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex justify-between items-center border-t border-gray-100 pt-2 mt-2">
                        <span>마지막 출석일</span>
                        <span className="font-medium text-gray-700">
                          {safeFormatDate(alert.lastAttendanceDate)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      소속 셀
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      마지막 출석일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      연속 결석 횟수
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {alerts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-sm text-gray-500"
                      >
                        조건에 해당하는 결석자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    alerts.map((alert) => {
                      const foundMember = allMembersForNameCheck.find(
                        (m) => m.id === alert.memberId
                      );
                      const displayName = foundMember
                        ? formatDisplayName(foundMember, allMembersForNameCheck)
                        : alert.memberName;

                      return (
                        <tr key={alert.memberId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {displayName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {alert.cellName || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {safeFormatDate(alert.lastAttendanceDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">
                            {alert.consecutiveAbsences}회
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() =>
                                navigate(`/admin/users/${alert.memberId}`)
                              }
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              상세보기
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceAlertsPage;
