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
    if (deleting) return; // 삭제 중에는 닫기 방지
    setShowDeleteConfirmModal(false);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!notice) return;

    try {
      setDeleting(true);
      setDeleteError(null);
      await noticeService.deleteNotice(notice.id); // Soft delete
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

  if (!notice) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-3xl text-center">
          <p className="text-gray-600 mb-4">
            공지사항을 찾을 수 없습니다. 삭제되었거나 권한이 없을 수 있습니다.
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-5 sm:px-6 py-6 sm:py-8">
            {/* Header Section */}
            <div className="border-b-2 border-gray-100 pb-4 mb-6">
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center">
                  {notice.pinned && (
                    <MapPinIcon className="h-6 w-6 text-indigo-500 mr-2 flex-shrink-0" />
                  )}
                  <span className="break-words">{notice.title}</span>
                </h1>

                {isExecutive && (
                  <div className="flex space-x-2 flex-shrink-0">
                    <button
                      onClick={handleEdit}
                      className="bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300 text-xs sm:text-sm"
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

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500">
                <span>
                  <strong>작성자:</strong>{" "}
                  {notice.createdBy?.name ?? "알 수 없음"}
                </span>
                <span className="text-gray-300 hidden sm:inline">|</span>
                <span>
                  <strong>작성일:</strong>{" "}
                  {new Date(notice.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Content Section */}
            <div className="mt-4 sm:mt-6">
              <div className="prose prose-sm sm:prose max-w-none text-gray-900">
                <ReactMarkdown>{notice.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate(-1)}
            className="bg-white text-gray-700 px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-sm w-full">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-gray-900">
              공지사항 삭제 확인
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              정말로 &quot;{notice.title}&quot; 공지사항을 삭제하시겠습니까?
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

export default NoticeDetailPage;
