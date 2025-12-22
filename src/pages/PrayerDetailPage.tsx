import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type { PrayerDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { checkUserRole } from "../utils/roleUtils";
import { PRAYER_VISIBILITY_MAP } from "../utils/prayerVisibilityUtils";
import ReactMarkdown from "react-markdown";

const PrayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [prayer, setPrayer] = useState<PrayerDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  // ── 2. [핵심 추가] 접근 권한 제어 로직 ────────────────
  useEffect(() => {
    // 로딩 중이거나 데이터/유저 정보가 없으면 검사하지 않음
    if (loading || !prayer || !user) return;

    // (1) 임원단(EXECUTIVE)은 모든 글 열람 가능 -> 통과
    if (user.role === "EXECUTIVE") return;

    // (2) 작성자 본인은 본인 글 열람 가능 -> 통과
    if (user.id === prayer.createdBy.id) return;

    // (3) 셀 리더(CELL_LEADER) 권한 체크
    if (user.role === "CELL_LEADER") {
      const currentYear = new Date().getFullYear();
      const prayerYear = new Date(prayer.createdAt).getFullYear();

      // 조건 1: 해당 연도(올해)의 기도제목인지 확인
      const isCurrentYear = prayerYear === currentYear;

      // 조건 2: 작성자가 내 셀원인지 확인
      // (prayer.member.cell.id 와 user.cellId 비교)
      const authorCellId = prayer.member?.cell?.id;
      const isMyCellMember = Number(authorCellId) === Number(user.cellId);

      if (!isCurrentYear || !isMyCellMember) {
        alert(
          "접근 권한이 없습니다.\n(타 셀원 또는 지난 연도의 기도제목은 조회할 수 없습니다.)"
        );
        navigate(-1); // 뒤로 가기
      }
      return;
    }

    // (4) 그 외 일반 멤버가 남의 글에 접근하려 할 경우 -> 차단
    alert("접근 권한이 없습니다.");
    navigate(-1);
  }, [loading, prayer, user, navigate]);

  // ── 3. 수정/삭제 권한 체크 (UI 노출용) ───────────────
  // 임원단이거나 본인일 때만 버튼 보임
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

  // ── 상태별 렌더링 ─────────────────────────────────
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

  const visibilityLabel = PRAYER_VISIBILITY_MAP[prayer.visibility];

  // ── 날짜 포맷/비교 로직 ────────────────────────────
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

  // ── 메인 렌더링 ────────────────────────────────────
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
                  {prayer.member?.name ?? "알 수 없음"}님의 기도제목
                </h1>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500">
                  <span>
                    <strong>작성자:</strong>{" "}
                    {prayer.createdBy?.name ?? "알 수 없음"}
                  </span>
                  <span className="text-gray-300 hidden sm:inline">|</span>
                  <span>
                    <strong>공개범위:</strong> {visibilityLabel}
                  </span>
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
