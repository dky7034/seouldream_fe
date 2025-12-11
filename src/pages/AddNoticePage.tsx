import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import type { CreateNoticeRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import NoticeForm, { type NoticeFormData } from "../components/NoticeForm";

const AddNoticePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ✅ EXECUTIVE가 아니면 목록으로 돌려보내기 (렌더 중 navigate 방지)
  useEffect(() => {
    if (!user) return; // 아직 유저 로딩 중일 수 있음

    if (user.role !== "EXECUTIVE") {
      navigate("/admin/notices");
    }
  }, [user, navigate]);

  // ✅ 1) 아직 user 정보 로딩 중일 때: 모바일 카드형 로딩 UI
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          사용자 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  // ✅ 2) user는 있는데 EXECUTIVE가 아닐 때 (위 useEffect에서 리다이렉트 진행 중)
  if (user.role !== "EXECUTIVE") {
    return null;
  }

  // ✅ 3) EXECUTIVE만 여기 도달
  const handleSubmit = async (formData: NoticeFormData) => {
    setLoading(true);
    setSubmitError(null);
    try {
      const dataToSend: CreateNoticeRequest = {
        ...(formData as CreateNoticeRequest),
        createdById: user.id,
      };

      await noticeService.createNotice(dataToSend);
      navigate("/admin/notices");
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message || "공지사항 생성에 실패했습니다."
      );
      console.error("공지사항 생성 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <NoticeForm
      onSubmit={handleSubmit}
      loading={loading}
      submitError={submitError}
      isEditing={false}
    />
  );
};

export default AddNoticePage;
