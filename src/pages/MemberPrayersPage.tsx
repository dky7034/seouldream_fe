// src/pages/MemberPrayersPage.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type { Page, PrayerDto, GetPrayersParams } from "../types";
import Pagination from "../components/Pagination";
import { useAuth } from "../hooks/useAuth";

const MemberPrayersPage: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pageData, setPageData] = useState<Page<PrayerDto> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [onlyThisWeek, setOnlyThisWeek] = useState(true);
  const [memberName, setMemberName] = useState<string | null>(null);

  const isExecutive = user?.role === "EXECUTIVE";
  const isCellLeader = user?.role === "CELL_LEADER";

  // ✅ 로컬(KST) 기준 YYYY-MM-DD 포맷 함수
  const toLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 0~11 → 1~12
    const day = d.getDate(); // 1~31
    const mm = month.toString().padStart(2, "0");
    const dd = day.toString().padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  };

  // ✅ 이번 주 범위 계산 (일 ~ 토, 한국 달력 기준)
  const getThisWeekRange = () => {
    const now = new Date();
    const day = now.getDay(); // 0(일) ~ 6(토)
    const diffToSunday = day;

    const sunday = new Date(now);
    sunday.setDate(now.getDate() - diffToSunday);

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    return {
      startDate: toLocalDateStr(sunday),
      endDate: toLocalDateStr(saturday),
    };
  };

  const fetchPrayers = useCallback(async () => {
    if (!memberId) return;

    // 권한 체크
    if (!user) {
      setError("로그인이 필요한 페이지입니다.");
      setLoading(false);
      return;
    }

    if (!isExecutive && !isCellLeader) {
      setError("이 페이지에 접근할 권한이 없습니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params: GetPrayersParams = {
      page: currentPage,
      size: 10,
      memberId: Number(memberId),
      sort: "createdAt,desc",
      isDeleted: false,
    };

    if (onlyThisWeek) {
      const { startDate, endDate } = getThisWeekRange();
      params.startDate = startDate;
      params.endDate = endDate;
    }

    try {
      const data = await prayerService.getPrayers(params);
      setPageData(data);

      // 첫 로딩 시 멤버 이름을 상태에 저장 (헤더 표시용)
      if (!memberName && data.content.length > 0) {
        setMemberName(data.content[0].member?.name ?? null);
      }
    } catch (e) {
      console.error("멤버별 기도제목 로딩 실패:", e);
      setError("기도제목을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    memberId,
    currentPage,
    onlyThisWeek,
    user,
    isExecutive,
    isCellLeader,
    memberName,
  ]);

  useEffect(() => {
    fetchPrayers();
  }, [fetchPrayers]);

  const titleSuffix = useMemo(
    () => (onlyThisWeek ? " (이번 주)" : " (전체 기간)"),
    [onlyThisWeek]
  );

  if (!memberId) {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="text-red-600 text-sm sm:text-base">
            올바르지 않은 접근입니다. 멤버 ID가 없습니다.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-gray-50 min-h-screen flex justify-center items-center px-4">
        <div className="bg-white rounded-lg shadow-sm p-6 max-w-md w-full text-center">
          <p className="text-red-600 text-sm sm:text-base">
            로그인이 필요한 페이지입니다.
          </p>
        </div>
      </div>
    );
  }

  const displayTitle =
    memberName != null
      ? `${memberName}님의 기도제목${titleSuffix}`
      : `멤버 ID ${memberId}의 기도제목${titleSuffix}`;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 상단 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {displayTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              선택한 멤버에 대해 등록된 기도제목 히스토리를 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* 상단에는 뒤로가기만 남김 */}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-xs sm:text-sm px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
            >
              뒤로가기
            </button>
          </div>
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-md">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <p className="text-center text-sm text-gray-500">로딩 중...</p>
        )}

        {/* 본문 */}
        {!loading && pageData && !error && (
          <>
            {/* 🔽 기간 토글 버튼 (테이블/카드 위로 이동) */}
            <div className="mb-3 sm:mb-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs sm:text-sm text-gray-600">
                조회 범위를 선택하세요.
              </p>
              <div className="inline-flex rounded-md shadow-sm overflow-hidden border bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(0);
                    setOnlyThisWeek(true);
                  }}
                  className={`px-3 py-1.5 text-xs sm:text-sm ${
                    onlyThisWeek
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  이번 주만 보기
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPage(0);
                    setOnlyThisWeek(false);
                  }}
                  className={`px-3 py-1.5 text-xs sm:text-sm border-l ${
                    !onlyThisWeek
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  전체 기간 보기
                </button>
              </div>
            </div>

            {/* 📱 모바일: 카드 리스트 (AdminTeams 스타일) */}
            <div className="space-y-3 md:hidden mb-4">
              {pageData.content.length === 0 ? (
                <div className="bg-white rounded-lg shadow border border-gray-100 p-4 text-center text-xs sm:text-sm text-gray-500">
                  조건에 맞는 기도제목이 없습니다.
                </div>
              ) : (
                pageData.content.map((prayer) => (
                  <div
                    key={prayer.id}
                    className="bg-white rounded-lg shadow border border-gray-100 p-4 text-xs"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        {/* 내용 */}
                        <Link
                          to={`/admin/prayers/${prayer.id}`}
                          className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 break-words"
                        >
                          {prayer.content}
                        </Link>
                        {/* 작성자 */}
                        <p className="mt-2 text-[11px] text-gray-500">
                          작성자(셀장):{" "}
                          <span className="font-semibold text-gray-800">
                            {prayer.createdBy?.name ?? "알 수 없음"}
                          </span>
                        </p>
                      </div>
                      {/* 작성일 뱃지 */}
                      <span className="px-2 py-1 inline-flex text-[11px] leading-5 font-semibold rounded-full bg-gray-100 text-gray-700 whitespace-nowrap">
                        {new Date(prayer.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 🖥 데스크탑: 테이블 */}
            <div className="hidden md:block bg-white shadow-md rounded-lg overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                      내용
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      작성자(셀장)
                    </th>
                    <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[11px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      작성일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageData.content.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500"
                      >
                        조건에 맞는 기도제목이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    pageData.content.map((prayer) => (
                      <tr key={prayer.id}>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 max-w-md">
                          <Link
                            to={`/admin/prayers/${prayer.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {prayer.content}
                          </Link>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm">
                          {prayer.createdBy?.name ?? "알 수 없음"}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm">
                          {new Date(prayer.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={pageData.number}
              totalPages={pageData.totalPages}
              totalElements={pageData.totalElements}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default MemberPrayersPage;
