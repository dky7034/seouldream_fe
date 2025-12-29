// src/pages/PrayerDetailPage.tsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { memberService } from "../services/memberService";
import { formatDisplayName } from "../utils/memberUtils";
import type { PrayerDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { checkUserRole } from "../utils/roleUtils";
import ReactMarkdown from "react-markdown";

const PrayerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [prayer, setPrayer] = useState<PrayerDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 동명이인 판별용 Map (id -> formattedName)
  const [memberMap, setMemberMap] = useState<Map<number, string>>(new Map());

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
    useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // ── 1. 데이터 조회 ──────────────────
  useEffect(() => {
    const numericId = id ? Number(id) : NaN;
    if (!id || Number.isNaN(numericId)) {
      setError("유효하지 않은 기도제목 ID입니다.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const fetchPrayer = prayerService
      .getPrayerById(numericId)
      .then((data) => setPrayer(data))
      .catch((err) => {
        console.error("Failed to fetch prayer:", err);
        throw new Error("기도제목을 불러오는 데 실패했습니다.");
      });

    const fetchMembers = memberService
      .getAllMembers({ page: 0, size: 2000, sort: "id,asc" })
      .then((res) => {
        const map = new Map<number, string>();
        const list = res.content;
        list.forEach((m) => {
          const formatted = formatDisplayName(m, list).replace(" (", "(");
          map.set(m.id, formatted);
        });
        setMemberMap(map);
      })
      .catch((e) => console.error("멤버 목록 로딩 실패:", e));

    Promise.all([fetchPrayer, fetchMembers])
      .catch((err: any) => setError(err.message || "데이터 로딩 실패"))
      .finally(() => setLoading(false));
  }, [id]);

  // ── 2. 이름 포맷팅 헬퍼 ──────────────────────────
  const getFormattedName = useCallback(
    (id?: number, name?: string) => {
      if (!name) return "알 수 없음";
      if (!id) return name;
      return memberMap.get(id) || name;
    },
    [memberMap]
  );

  // ── 3. 접근 권한 제어 ─────────────────────────────
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

  // ── 4. 권한 체크 및 핸들러 ────────────────────────
  const canModify =
    !!user &&
    (checkUserRole(user, ["EXECUTIVE"]) ||
      (!!prayer && user.id === prayer.createdBy.id));

  const handleEdit = () => {
    if (prayer) navigate(`/admin/prayers/${prayer.id}/edit`);
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
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-sm text-center max-w-sm w-full">
          <p className="text-red-600 mb-4 text-sm font-medium">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-white text-gray-700 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!prayer) return null;

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
    <div className="bg-gray-50 min-h-screen pb-10">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        {/* 상세 카드 */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl overflow-hidden">
          {/* ✅ 모바일 패딩 px-4로 최적화 (데스크탑은 px-8 유지) */}
          <div className="px-4 py-6 sm:px-8 sm:py-8">
            {/* Header Section */}
            <div className="border-b border-gray-100 pb-5 mb-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                {/* Title */}
                <h1 className="flex-1 text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-snug break-words break-keep">
                  <span className="text-gray-900">
                    {getFormattedName(prayer.member?.id, prayer.member?.name)}
                  </span>
                  <span className="text-gray-800">님의 기도제목</span>
                </h1>

                {/* Buttons */}
                {canModify && (
                  <div className="flex gap-2 self-end sm:self-auto flex-shrink-0">
                    <button
                      onClick={handleEdit}
                      className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-200 text-xs sm:text-sm font-medium transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="bg-red-50 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-100 text-xs sm:text-sm font-medium transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {/* Metadata */}
              {/* ✅ flex-wrap으로 모바일에서 자연스럽게 줄바꿈되도록 수정 */}
              <div className="mt-4 flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">작성자</span>
                  <span>
                    {getFormattedName(
                      prayer.createdBy?.id,
                      prayer.createdBy?.name
                    )}
                  </span>
                </div>

                <span className="text-gray-300">|</span>

                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-gray-700">작성일</span>
                  <span>{createdLabel}</span>
                </div>

                {hasEdited && (
                  <>
                    <span className="text-gray-300">|</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-700">수정일</span>
                      <span>{updatedLabel}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Content Section */}
            <div className="prose prose-sm sm:prose max-w-none text-gray-800 break-words leading-relaxed">
              <ReactMarkdown
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="rounded-lg max-w-full h-auto shadow-sm my-4"
                      alt={props.alt || "content-image"}
                    />
                  ),
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-indigo-600 hover:text-indigo-800 underline break-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  p: ({ node, ...props }) => (
                    <p {...props} className="mb-4 whitespace-pre-line" />
                  ),
                }}
              >
                {prayer.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* 하단 돌아가기 버튼 (원래대로 유지) */}
        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-all"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full transform transition-all">
            <h2 className="text-lg font-bold mb-3 text-gray-900">
              기도제목 삭제
            </h2>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed break-keep">
              정말로 이 기도제목을 삭제하시겠습니까?
              <br />
              <span className="text-xs text-red-500 mt-1 block">
                * 삭제 후에는 복구할 수 없습니다.
              </span>
            </p>

            {deleteError && (
              <div className="p-3 text-xs font-medium text-red-700 bg-red-50 rounded-lg mb-4">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={handleCloseDeleteConfirmModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={deleting}
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrayerDetailPage;
