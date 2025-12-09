import React, { useEffect, useState, useCallback } from "react";
import { attendanceService } from "../services/attendanceService";
import type { MemberAlertDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

const AttendanceAlertsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState<MemberAlertDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [consecutiveAbsences, setConsecutiveAbsences] = useState<string | number>(3);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const threshold = Math.max(1, Number(consecutiveAbsences) || 1);
      const data = await attendanceService.getAttendanceAlerts(threshold);
      setAlerts(data);
    } catch (err) {
      console.error("출석 경고 목록 로딩 실패:", err);
      setError("출석 경고 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [consecutiveAbsences]);

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

    fetchAlerts();
  }, [user, fetchAlerts]);

  const handleSearch = () => {
    const threshold = Math.max(1, Number(consecutiveAbsences) || 1);
    // Ensure state is a valid number before refetching
    if (Number(consecutiveAbsences) !== threshold) {
      setConsecutiveAbsences(threshold);
    }
    fetchAlerts();
  };

  const handleBlur = () => {
    const value = Number(consecutiveAbsences);
    if (Number.isNaN(value) || value < 1) {
      setConsecutiveAbsences(1);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600">로그인이 필요한 페이지입니다.</p>
      </div>
    );
  }

  if (!["EXECUTIVE", "CELL_LEADER"].includes(user.role)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-600 text-center">
          출석 경고 목록 페이지에 접근할 권한이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">결석 관리</h1>
          <p className="mt-2 text-sm text-gray-600">
            설정한 연속 결석 횟수를 기준으로, 추가적인 관리가 필요한 멤버들을
            한눈에 확인할 수 있는 페이지입니다.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="consecutiveAbsences"
              className="block text-sm font-medium text-gray-700"
            >
              연속 결석 횟수 기준
            </label>
            <input
              id="consecutiveAbsences"
              type="number"
              min={1}
              value={consecutiveAbsences}
              onChange={(e) => setConsecutiveAbsences(e.target.value)}
              onBlur={handleBlur}
              className="mt-1 p-2 border rounded-md w-24"
            />
            <p className="mt-1 text-xs text-gray-500">
              예: 3으로 설정하면 3회 연속 결석한 멤버부터 조회합니다.
            </p>
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-white ${
              loading
                ? "bg-indigo-300 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center min-h-[200px]">
          <p className="text-gray-600">로딩 중...</p>
        </div>
      )}

      {!loading && (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  멤버 이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  셀 이름
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  마지막 출석일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  연속 결석 횟수
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <tr key={alert.memberId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() =>
                          navigate(`/admin/users/${alert.memberId}`)
                        }
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {alert.memberName}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {alert.cellName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {alert.lastAttendanceDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600">
                      {alert.consecutiveAbsences}회
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-10 text-gray-500 text-sm"
                  >
                    설정한 기준에 해당하는 경고 대상이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceAlertsPage;
