// src/pages/PrayerDetailPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import type { PrayerDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { checkUserRole } from "../utils/roleUtils";
// [변경] 공개범위 관련 import 제거
// import { PRAYER_VISIBILITY_MAP } from "../utils/prayerVisibilityUtils";
import ReactMarkdown from "react-markdown";

const PrayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [prayer, setPrayer] = useState<PrayerDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 동명이인 판별을 위한 전체 멤버 리스트
  const [allMembersForNameCheck, setAllMembersForNameCheck] = useState<
    { id: number; name: string; birthDate?: string }[]
  >([]);

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
    useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // ── 1. 기도제목 데이터 조회 ──────────────────────────
  useEffect(() => {
    const fetchPrayer = async () => {
      const numericId = id ? Number(id) : NaN;

      if (!id || Number.isNaN(numericId)) {
        setError("유효하지 않은 기도제목 ID입니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await prayerService.getPrayerById(numericId);
        setPrayer(data);
      } catch (err) {
        setError("기도제목을 불러오는 데 실패했습니다.");
        console.error("Failed to fetch prayer:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrayer();
  }, [id]);

  // ── 동명이인 판별을 위한 전체 멤버 목록 로딩 ──────────
  useEffect(() => {
    if (!user) return;

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

  // 이름 포맷팅 헬퍼 함수
  const getFormattedName = useCallback(
    (id?: number, name?: string) => {
      if (!name) return "알 수 없음";
      if (!id) return name;

      const found = allMembersForNameCheck.find((m) => m.id === id);
      if (found) {
        return formatDisplayName(found, allMembersForNameCheck).replace(
          " (",
          "("
        );
      }
      return name;
    },
    [allMembersForNameCheck]
  );

  // ── 2. 접근 권한 제어 로직 ──────────────────────────
  useEffect(() => {
    if (loading || !prayer || !user) return;

    if (user.role === "EXECUTIVE") return;
    if (user.id === prayer.createdBy.id) return;

    if (user.role === "CELL_LEADER") {
      const currentYear = new Date().getFullYear();
      const prayerYear = new Date(prayer.createdAt).getFullYear();
      const isCurrentYear = prayerYear === currentYear;
      const authorCellId = prayer.member?.cell?.id;
      const isMyCellMember = Number(authorCellId) === Number(user.cellId);

      if (!isCurrentYear || !isMyCellMember) {
        alert(
          "접근 권한이 없습니다.\n(타 셀원 또는 지난 연도의 기도제목은 조회할 수 없습니다.)"
        );
        navigate(-1);
      }
      return;
    }

    alert("접근 권한이 없습니다.");
    navigate(-1);
  }, [loading, prayer, user, navigate]);

  // ── 3. 수정/삭제 권한 체크 ──────────────────────────
  const canModify =
    !!user &&
    (checkUserRole(user, ["EXECUTIVE"]) ||
      (!!prayer && user.id === prayer.createdBy.id));

  // ── 핸들러들 ──────────────────────────────────────
  const handleEdit = () => {
    if (prayer) {
      navigate(`/admin/prayers/${prayer.id}/edit`);
    }
  };

  const handleDeleteClick = () => {
    setDeleteError(null);
    setShowDeleteConfirmModal(true);
  };

  const handleCloseDeleteConfirmModal = () => {
    if (deleting) return;
    setShowDeleteConfirmModal(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!prayer) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await prayerService.deletePrayer(prayer.id);
      navigate("/admin/prayers");
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message || "기도제목 삭제에 실패했습니다."
      );
      console.error("기도제목 삭제 오류:", err);
    } finally {
      setDeleting(false);
    }
  };

  // ── 렌더링 ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
        <p className="text-lg text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-3xl text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!prayer) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-3xl text-center">
          <p className="text-gray-600 mb-4">
            기도제목을 찾을 수 없습니다. 삭제되었거나 권한이 없을 수 있습니다.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // [변경] 공개범위 변수 할당 제거
  // const visibilityLabel = PRAYER_VISIBILITY_MAP[prayer.visibility];

  const created = new Date(prayer.createdAt);
  const updated = prayer.updatedAt ? new Date(prayer.updatedAt) : null;

  const formatDateTime = (date: Date) =>
    date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const createdLabel = formatDateTime(created);

  let updatedLabel = "-";
  let hasEdited = false;

  if (updated) {
    const createdTime = created.getTime();
    const updatedTime = updated.getTime();

    if (updatedTime !== createdTime) {
      hasEdited = true;
      updatedLabel = formatDateTime(updated);
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 상세 카드 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-5 sm:px-6 py-6 sm:py-8">
            {/* 헤더 */}
            <div className="border-b border-gray-100 pb-4 mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 break-words">
                  {/* 이름 출력 부분 */}
                  {getFormattedName(prayer.member?.id, prayer.member?.name)}
                  님의 기도제목
                </h1>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500">
                  <span>
                    <strong>작성자:</strong>{" "}
                    {getFormattedName(
                      prayer.createdBy?.id,
                      prayer.createdBy?.name
                    )}
                  </span>

                  {/* [변경] 공개범위 표시 부분 및 구분선(|) 제거됨 */}

                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <span>
                    <strong>생성일:</strong> {createdLabel}
                  </span>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <span>
                    <strong>수정일:</strong>{" "}
                    {hasEdited ? updatedLabel : "수정 이력 없음"}
                  </span>
                </div>
              </div>

              {/* 수정/삭제 버튼 */}
              {canModify && (
                <div className="flex flex-shrink-0 space-x-2 self-start">
                  <button
                    onClick={handleEdit}
                    className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 text-xs sm:text-sm"
                  >
                    수정
                  </button>
                  <button
                    onClick={handleDeleteClick}
                    className="bg-red-100 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-200 text-xs sm:text-sm"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>

            {/* 내용 */}
            <div className="mt-4 sm:mt-6">
              <div className="prose prose-sm sm:prose max-w-none text-gray-900">
                <ReactMarkdown>{prayer.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 돌아가기 버튼 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-900">
              기도제목 삭제 확인
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              정말로 이 기도제목을 삭제하시겠습니까?
            </p>
            {deleteError && (
              <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md mb-4">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCloseDeleteConfirmModal}
                className="bg-gray-300 text-gray-800 px-3 py-2 rounded-md text-sm hover:bg-gray-400"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="bg-red-600 text-white px-3 py-2 rounded-md text-sm disabled:opacity-60"
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrayerDetailPage;
