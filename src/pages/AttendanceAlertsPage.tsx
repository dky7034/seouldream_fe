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
import {
  ExclamationCircleIcon,
  FunnelIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  MagnifyingGlassIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

type UnitType = "semester" | "year";

const AttendanceAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // --- 상태 관리 ---
  const [alerts, setAlerts] = useState<MemberAlertDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);
  const [consecutiveAbsences, setConsecutiveAbsences] = useState<string>("3");
  const [unitType, setUnitType] = useState<UnitType>("semester");
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear()
  );
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | "">("");
  const [hasAutoSelectedSemester, setHasAutoSelectedSemester] = useState(false);

  // 날짜 포맷터
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

  // 데이터 로딩
  const fetchSemesters = useCallback(async () => {
    try {
      setSemesters(await semesterService.getAllSemesters(true));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchAvailableYears = useCallback(async () => {
    try {
      setAvailableYears(await attendanceService.getAvailableYears());
    } catch (err) {
      console.error(err);
      setAvailableYears([new Date().getFullYear()]);
    }
  }, []);

  useEffect(() => {
    if (user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      fetchSemesters();
      fetchAvailableYears();
      memberService
        .getAllMembers({ page: 0, size: 2000, sort: "id,asc" })
        .then((p) => setAllMembersForNameCheck(p.content))
        .catch(console.error);
    }
  }, [user, fetchSemesters, fetchAvailableYears]);

  // 스마트 자동 선택
  useEffect(() => {
    if (semesters.length > 0 && !hasAutoSelectedSemester) {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      let target = semesters.find(
        (s) =>
          s.startDate.substring(0, 7) <= ym && s.endDate.substring(0, 7) >= ym
      );
      if (!target) target = [...semesters].sort((a, b) => b.id - a.id)[0];
      if (target) {
        setUnitType("semester");
        setSelectedSemesterId(target.id);
      } else {
        setUnitType("year");
        setSelectedYear(now.getFullYear());
      }
      setHasAutoSelectedSemester(true);
    }
  }, [semesters, hasAutoSelectedSemester, selectedYear]);

  // 조회 로직
  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const threshold = Math.max(1, Number(consecutiveAbsences) || 1);
    try {
      const params: GetAttendanceAlertsParams = {
        consecutiveAbsences: threshold,
      };
      if (unitType === "year") params.year = selectedYear;
      else if (unitType === "semester" && selectedSemesterId)
        params.semesterId = selectedSemesterId;
      setAlerts(await attendanceService.getAttendanceAlerts(params));
    } catch (err) {
      console.error(err);
      setError("데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [user, consecutiveAbsences, unitType, selectedYear, selectedSemesterId]);

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

  // 핸들러
  const handleUnitTypeClick = (type: UnitType) => {
    setUnitType(type);
    if (type === "year" && !selectedYear)
      setSelectedYear(
        availableYears.length > 0 ? availableYears[0] : new Date().getFullYear()
      );
  };
  const handleSearchClick = () => void fetchAlerts();
  const handleBlur = () => {
    if (Number(consecutiveAbsences) < 1) setConsecutiveAbsences("3");
  };

  const yearOptions = useMemo(
    () =>
      availableYears.length === 0
        ? [
            {
              value: new Date().getFullYear(),
              label: `${new Date().getFullYear()}년`,
            },
          ]
        : availableYears.map((y) => ({ value: y, label: `${y}년` })),
    [availableYears]
  );

  if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role))
    return (
      <div className="p-10 text-center text-red-500">권한이 없습니다.</div>
    );

  return (
    <div className="bg-gray-50 min-h-screen pb-20">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ExclamationCircleIcon className="h-7 w-7 text-red-500" />
              결석 관리
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              장기 결석자를 파악하고 관리합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-700 flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" /> {error}
          </div>
        )}

        {/* Filter Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 space-y-5">
          <div className="flex flex-col sm:flex-row items-start gap-5">
            {/* Unit Toggle */}
            <div className="sm:w-1/3">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                <FunnelIcon className="h-4 w-4" /> 조회 기준
              </label>
              {/* ✅ 수정: 개별 버튼 + gap-2 */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleUnitTypeClick("semester")}
                  // ✅ 수정: text-xs sm:text-sm (모바일 글자 작게), whitespace-nowrap
                  className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
                    unitType === "semester"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  학기별
                </button>
                <button
                  onClick={() => handleUnitTypeClick("year")}
                  // ✅ 수정: text-xs sm:text-sm, whitespace-nowrap
                  className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg border shadow-sm transition-all whitespace-nowrap ${
                    unitType === "year"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  연도별
                </button>
              </div>
            </div>

            {/* Selection Area */}
            <div className="flex-1 w-full">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1">
                <CalendarDaysIcon className="h-4 w-4" />{" "}
                {unitType === "semester" ? "학기 선택" : "연도 선택"}
              </label>
              {unitType === "semester" ? (
                <div className="flex flex-wrap gap-2">
                  {semesters.length === 0 ? (
                    <span className="text-sm text-gray-400 py-2">
                      학기 없음
                    </span>
                  ) : (
                    semesters.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSemesterId(s.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-bold border shadow-sm transition-all ${
                          selectedSemesterId === s.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                            : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
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
                  className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                >
                  {yearOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-end gap-4">
            <div className="w-full sm:flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">
                연속 결석 기준 (회)
              </label>
              <input
                type="number"
                min={1}
                value={consecutiveAbsences}
                onChange={(e) => setConsecutiveAbsences(e.target.value)}
                onBlur={handleBlur}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
              />
            </div>
            <button
              onClick={handleSearchClick}
              disabled={loading}
              className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4" />
              )}
              조회하기
            </button>
          </div>
        </div>

        {/* Results */}
        {!loading && (
          <>
            <div className="flex items-center gap-2 mb-4 px-1">
              <UserGroupIcon className="h-5 w-5 text-gray-400" />
              <span className="font-bold text-gray-700">
                검색 결과{" "}
                <span className="text-indigo-600">{alerts.length}</span>명
              </span>
            </div>

            <div className="space-y-3 md:hidden">
              {alerts.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 text-sm">
                  해당하는 멤버가 없습니다.
                </div>
              ) : (
                alerts.map((alert) => {
                  const displayName = allMembersForNameCheck.find(
                    (m) => m.id === alert.memberId
                  )
                    ? formatDisplayName(
                        allMembersForNameCheck.find(
                          (m) => m.id === alert.memberId
                        )!,
                        allMembersForNameCheck
                      )
                    : alert.memberName;
                  return (
                    <div
                      key={alert.memberId}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-red-200 transition-all"
                    >
                      <div className="absolute top-0 right-0 p-3">
                        <span className="bg-red-50 text-red-600 text-xs font-extrabold px-2 py-1 rounded-lg border border-red-100">
                          {alert.consecutiveAbsences}회 연속
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-lg">
                          {displayName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-gray-900">
                            {displayName}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {alert.cellName || "소속 셀 없음"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs">
                        <div className="text-gray-500">
                          마지막 출석:{" "}
                          <span className="font-medium text-gray-900">
                            {safeFormatDate(alert.lastAttendanceDate)}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            navigate(`/admin/users/${alert.memberId}`)
                          }
                          className="text-indigo-600 font-bold flex items-center gap-0.5"
                        >
                          상세보기 <ChevronRightIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      이름
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      소속 셀
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      마지막 출석
                    </th>
                    <th className="px-6 py-3 text-left font-bold text-gray-500 uppercase text-xs">
                      연속 결석
                    </th>
                    <th className="px-6 py-3 text-right font-bold text-gray-500 uppercase text-xs">
                      {/* 관리 */}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {alerts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        결과가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    alerts.map((alert) => {
                      const displayName = allMembersForNameCheck.find(
                        (m) => m.id === alert.memberId
                      )
                        ? formatDisplayName(
                            allMembersForNameCheck.find(
                              (m) => m.id === alert.memberId
                            )!,
                            allMembersForNameCheck
                          )
                        : alert.memberName;
                      return (
                        <tr
                          key={alert.memberId}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {displayName}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {alert.cellName || "-"}
                          </td>
                          <td className="px-6 py-4 text-gray-500">
                            {safeFormatDate(alert.lastAttendanceDate)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-red-50 text-red-700 px-2 py-1 rounded font-bold text-xs">
                              {alert.consecutiveAbsences}회
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() =>
                                navigate(`/admin/users/${alert.memberId}`)
                              }
                              className="text-indigo-600 hover:text-indigo-900 font-bold text-xs"
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
