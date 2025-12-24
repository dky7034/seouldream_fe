// src/pages/AttendanceAlertsPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { attendanceService } from "../services/attendanceService";
import { memberService } from "../services/memberService";
import { useAuth } from "../hooks/useAuth";
import { formatDisplayName } from "../utils/memberUtils";
import type { MemberAlertDto } from "../types";

const AttendanceAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<MemberAlertDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 동명이인 판별을 위한 전체 멤버 리스트
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  // 인풋은 문자열 중심으로 관리
  const [consecutiveAbsences, setConsecutiveAbsences] = useState<string>("3");

  // ✅ [추가] 날짜 포맷팅 함수 (타임존 문제 해결 및 일관성 유지)
  const safeFormatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "-";
    // T는 있는데 Z가 없으면 Z를 붙여줌 (UTC 인식 유도 -> 브라우저가 KST 변환)
    const targetStr =
      dateStr.includes("T") && !dateStr.endsWith("Z") ? `${dateStr}Z` : dateStr;

    const date = new Date(targetStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}.${month}.${day}`;
  };

  // --- 출석 경고 목록 조회 ---
  const fetchAlerts = useCallback(async (threshold: number) => {
    setLoading(true);
    setError(null);

    try {
      const safeThreshold = Math.max(1, threshold || 1);
      const data = await attendanceService.getAttendanceAlerts(safeThreshold);
      setAlerts(data);
    } catch (err) {
      console.error("출석 경고 목록 로딩 실패:", err);
      setError("출석 경고 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- 초기 로딩 ---
  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError("로그인이 필요한 페이지입니다.");
      return;
    }

    if (!["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
      setLoading(false);
      setError("출석 경고 목록 페이지에 접근할 권한이 없습니다.");
      return;
    }

    void fetchAlerts(3);
  }, [user, fetchAlerts]);

  // --- 동명이인 처리를 위해 전체 멤버 목록 미리 로딩 ---
  useEffect(() => {
    if (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role)) return;

    const fetchAllMembers = async () => {
      try {
        const page = await memberService.getAllMembers({
          page: 0,
          size: 2000,
          sort: "id,asc",
        });

        const list = page.content.map((m) => ({
          id: m.id,
          name: m.name,
          birthDate: m.birthDate,
        }));
        setAllMembersForNameCheck(list);
      } catch (e) {
        console.error("동명이인 확인용 멤버 목록 로딩 실패:", e);
      }
    };

    fetchAllMembers();
  }, [user]);

  // --- 조회 버튼 핸들러 ---
  const handleSearch = () => {
    const value = Number(consecutiveAbsences);
    const threshold = Math.max(1, isNaN(value) ? 1 : value);

    if (consecutiveAbsences !== String(threshold)) {
      setConsecutiveAbsences(String(threshold));
    }

    void fetchAlerts(threshold);
  };

  const handleBlur = () => {
    const value = Number(consecutiveAbsences);
    if (Number.isNaN(value) || value < 1) {
      setConsecutiveAbsences("1");
    }
  };

  if (error && (!user || !["EXECUTIVE", "CELL_LEADER"].includes(user.role))) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4 text-sm sm:text-base">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              결석 관리
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              설정한 연속 결석 횟수를 기준으로, 추가적인 관리가 필요한 멤버들을
              한눈에 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {error && user && ["EXECUTIVE", "CELL_LEADER"].includes(user.role) && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 필터 영역 */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow-sm">
          <div className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="consecutiveAbsences"
                className="block text-sm font-medium text-gray-700"
              >
                연속 결석 횟수 기준
              </label>

              <div className="mt-1 flex items-center gap-2">
                <input
                  id="consecutiveAbsences"
                  type="number"
                  min={1}
                  value={consecutiveAbsences}
                  onChange={(e) => setConsecutiveAbsences(e.target.value)}
                  onBlur={handleBlur}
                  className="p-2 border rounded-md w-24 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={loading}
                  className={`px-3 py-2 rounded-md text-sm font-medium text-white sm:min-w-[80px] ${
                    loading
                      ? "bg-indigo-300 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {loading ? "조회…" : "조회"}
                </button>
              </div>

              <p className="mt-1 text-[11px] sm:text-xs text-gray-500">
                예: 3으로 설정하면 3회 연속 결석한 멤버부터 조회합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center min-h-[200px] sm:min-h-[220px]">
            <p className="text-gray-600 text-sm">
              출석 경고 목록을 불러오는 중입니다...
            </p>
          </div>
        )}

        {/* 결과 영역 */}
        {!loading && (
          <>
            <div className="mb-3 text-xs sm:text-sm text-gray-700">
              <span className="font-medium">
                {consecutiveAbsences || "1"}회 연속 결석 기준
              </span>
              <span className="mx-1">·</span>
              <span>현재 {alerts.length}명</span>
            </div>

            {/* 📱 모바일: 카드 리스트 */}
            <div className="space-y-3 md:hidden mb-4">
              {alerts.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-4 text-center text-xs sm:text-sm text-gray-500">
                  설정한 기준에 해당하는 경고 대상이 없습니다.
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
                      className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs space-y-2"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/users/${alert.memberId}`)
                            }
                            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900 text-left"
                          >
                            {displayName}
                          </button>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            셀:{" "}
                            <span className="font-medium text-gray-700">
                              {alert.cellName || "*소속 셀 없음"}
                            </span>
                          </p>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-red-50 text-[11px] font-semibold text-red-600 whitespace-nowrap">
                          {alert.consecutiveAbsences}회 연속 결석
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between items-center text-[11px] text-gray-600">
                        <span className="font-medium">마지막 출석일</span>
                        <span>
                          {/* ✅ safeFormatDate 적용 */}
                          {safeFormatDate(alert.lastAttendanceDate)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 🖥 데스크탑: 테이블 */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        멤버 이름
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        셀 이름
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        마지막 출석일
                      </th>
                      <th className="px-4 sm:px-6 py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                        연속 결석 횟수
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {alerts.length > 0 ? (
                      alerts.map((alert) => {
                        const foundMember = allMembersForNameCheck.find(
                          (m) => m.id === alert.memberId
                        );
                        const displayName = foundMember
                          ? formatDisplayName(
                              foundMember,
                              allMembersForNameCheck
                            )
                          : alert.memberName;

                        return (
                          <tr key={alert.memberId}>
                            <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm font-medium">
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(`/admin/users/${alert.memberId}`)
                                }
                                className="text-indigo-600 hover:text-indigo-900"
                              >
                                {displayName}
                              </button>
                            </td>
                            <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                              {alert.cellName || "*소속 셀 없음"}
                            </td>
                            <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm text-gray-700">
                              {/* ✅ safeFormatDate 적용 */}
                              {safeFormatDate(alert.lastAttendanceDate)}
                            </td>
                            <td className="px-4 sm:px-6 py-3 whitespace-nowrap text-xs sm:text-sm font-bold text-red-600">
                              {alert.consecutiveAbsences}회
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center py-10 px-4 sm:px-6 text-gray-500 text-xs sm:text-sm"
                        >
                          설정한 기준에 해당하는 경고 대상이 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceAlertsPage;
