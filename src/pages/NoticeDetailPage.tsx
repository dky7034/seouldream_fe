import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import type { NoticeDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import { checkUserRole } from "../utils/roleUtils";
import {
  MapPinIcon,
  UserCircleIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/solid"; // 아이콘 추가
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
      } finally {
        setLoading(false);
      }
    };
    fetchNotice();
  }, [noticeId]);

  const handleEdit = () => {
    if (notice) navigate(`/admin/notices/${notice.id}/edit`);
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
      {/* Container: 모바일 여백(px-4) vs 데스크탑 여백(px-6) 조정 */}
      <div className="container mx-auto px-4 py-6 sm:px-6 sm:py-10 max-w-4xl">
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
          <div className="px-5 py-6 sm:px-10 sm:py-10">
            {/* 1. Header Section 개선 */}
            <div className="border-b border-gray-100 pb-6 mb-6">
              {/* Title: break-keep 적용으로 한글 단어 잘림 방지 */}
              <h1 className="flex items-start text-xl sm:text-3xl font-bold text-gray-900 leading-snug break-keep mb-4">
                {notice.pinned && (
                  <MapPinIcon className="h-6 w-6 text-indigo-500 mr-2 flex-shrink-0 mt-0.5" />
                )}
                {notice.title}
              </h1>

              {/* Meta & Buttons Wrapper: 모바일에서는 위아래 배치 대신, 양옆 배치를 시도하거나 깔끔하게 줄바꿈 */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                {/* Metadata: 아이콘 활용하여 가독성 높임 */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <UserCircleIcon className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-700">
                      {notice.createdBy?.name ?? "알 수 없음"}
                    </span>
                  </div>
                  <div className="hidden sm:block w-px h-3 bg-gray-300"></div>{" "}
                  {/* 모바일엔 숨기고 데스크탑엔 구분선 */}
                  <div className="flex items-center gap-1.5">
                    <CalendarDaysIcon className="h-4 w-4 text-gray-400" />
                    <span>{new Date(notice.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                {/* Buttons: 임원일 때만 표시 */}
                {isExecutive && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={handleEdit}
                      className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 text-xs sm:text-sm font-medium transition-colors"
                    >
                      수정
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="bg-red-50 border border-transparent text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-100 text-xs sm:text-sm font-medium transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Content Section 개선 */}
            {/* prose-sm: 모바일 폰트 크기 최적화, break-all/break-words 조화 */}
            <div className="prose prose-sm sm:prose max-w-none text-gray-800 break-words leading-relaxed overflow-hidden">
              <ReactMarkdown
                components={{
                  img: ({ node, ...props }) => (
                    <img
                      {...props}
                      className="rounded-xl w-full h-auto shadow-sm my-4" // 모바일에서 이미지 꽉 차게
                      alt={props.alt || "content-image"}
                    />
                  ),
                  a: ({ node, ...props }) => (
                    <a
                      {...props}
                      className="text-indigo-600 hover:text-indigo-800 underline break-all font-medium" // 긴 링크 줄바꿈 처리
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

        {/* 3. Bottom Button 개선 */}
        <div className="mt-6 text-center sm:text-left">
          <button
            onClick={() => navigate("/admin/notices")}
            // 모바일(기본): w-full (터치하기 쉽게), 데스크탑(sm): w-auto
            className="w-full sm:w-auto bg-white text-gray-700 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 text-sm font-bold shadow-sm transition-all"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>

      {/* Delete Modal: 모바일 폭 대응 (w-[90%] or mx-4) */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-sm transform transition-all">
            <h2 className="text-lg font-bold mb-3 text-gray-900">
              공지사항 삭제
            </h2>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed break-keep">
              정말로{" "}
              <span className="font-bold text-gray-900">"{notice.title}"</span>{" "}
              공지사항을 삭제하시겠습니까?
              <br className="hidden sm:block" /> 복구할 수 없는 작업입니다.
            </p>

            {deleteError && (
              <div className="p-3 text-xs font-medium text-red-700 bg-red-50 rounded-lg mb-4 break-keep">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCloseDeleteConfirmModal}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                disabled={deleting}
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-md transition-colors"
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
