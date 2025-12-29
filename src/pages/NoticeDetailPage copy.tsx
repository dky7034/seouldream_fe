import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import type { NoticeDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { checkUserRole } from "../utils/roleUtils";
import { MapPinIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";

const NoticeDetailPage: React.FC = () => {
  const { noticeId } = useParams<{ noticeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [notice, setNotice] = useState<NoticeDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] =
    useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  useEffect(() => {
    const fetchNotice = async () => {
      const id = noticeId ? Number(noticeId) : NaN;

      if (!noticeId || Number.isNaN(id)) {
        setError("유효하지 않은 공지사항 ID입니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await noticeService.getNoticeById(id);
        setNotice(data);
      } catch (err) {
        setError("공지사항을 불러오는 데 실패했습니다.");
        console.error("Failed to fetch notice:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotice();
  }, [noticeId]);

  const handleEdit = () => {
    if (notice) {
      navigate(`/admin/notices/${notice.id}/edit`);
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
    if (!notice) return;

    try {
      setDeleting(true);
      setDeleteError(null);
      await noticeService.deleteNotice(notice.id);
      navigate("/admin/notices");
    } catch (err: any) {
      setDeleteError(
        err?.response?.data?.message || "공지사항 삭제에 실패했습니다."
      );
      console.error("공지사항 삭제 오류:", err);
    } finally {
      setDeleting(false);
    }
  };

  const isExecutive = user ? checkUserRole(user, ["EXECUTIVE"]) : false;

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
            onClick={() => navigate("/admin/notices")}
            className="w-full bg-white text-gray-700 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!notice) return null;

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-4xl">
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-xl overflow-hidden">
          <div className="px-5 py-6 sm:px-8 sm:py-8">
            {/* Header Section */}
            <div className="border-b border-gray-100 pb-5 mb-6">
              {/* ✅ [개선] 모바일: 세로 배치 / 데스크탑: 가로 배치 */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                {/* Title */}
                <h1 className="flex-1 flex items-start text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-snug break-words break-keep">
                  {notice.pinned && (
                    <MapPinIcon className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-500 mr-2 flex-shrink-0 mt-1" />
                  )}
                  <span>{notice.title}</span>
                </h1>

                {/* Buttons (데스크탑: 우측 상단 / 모바일: 아래로 이동) */}
                {isExecutive && (
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
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-500 gap-y-1 gap-x-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">작성자</span>
                  <span>{notice.createdBy?.name ?? "알 수 없음"}</span>
                </div>
                <span className="hidden sm:inline text-gray-300">|</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">작성일</span>
                  <span>{new Date(notice.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="prose prose-sm sm:prose max-w-none text-gray-800 break-words leading-relaxed">
              <ReactMarkdown
                components={{
                  // 이미지 모바일 최적화
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="rounded-lg max-w-full h-auto shadow-sm"
                      alt={props.alt || "content-image"}
                    />
                  ),
                  // 링크 스타일
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-indigo-600 hover:text-indigo-800 underline break-all"
                      target="_blank"
                      rel="noopener noreferrer"
                    />
                  ),
                }}
              >
                {notice.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/admin/notices")}
            className="bg-white text-gray-700 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium shadow-sm transition-all"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full transform transition-all">
            <h2 className="text-lg font-bold mb-3 text-gray-900">
              공지사항 삭제
            </h2>
            <p className="text-sm text-gray-600 mb-5 leading-relaxed break-keep">
              정말로{" "}
              <span className="font-semibold text-gray-900">
                "{notice.title}"
              </span>{" "}
              공지사항을 삭제하시겠습니까?
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

export default NoticeDetailPage;
