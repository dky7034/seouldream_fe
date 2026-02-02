// src/pages/AddNoticePage.tsx
import React, { useEffect, useState } from "react";
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

  // ✅ 권한 체크: EXECUTIVE가 아니면 목록으로 리다이렉트
  useEffect(() => {
    if (!user) return; // 유저 정보 로딩 대기

    if (user.role !== "EXECUTIVE") {
      navigate("/admin/notices");
    }
  }, [user, navigate]);

  // ✅ 1) 유저 정보 로딩 중 UI
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          멤버 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  // ✅ 2) 권한이 없는 경우 렌더링 차단
  if (user.role !== "EXECUTIVE") {
    return null;
  }

  // ✅ 공지사항 등록 핸들러
  const handleSubmit = async (formData: NoticeFormData) => {
    setLoading(true);
    setSubmitError(null);
    try {
      const dataToSend: CreateNoticeRequest = {
        ...(formData as CreateNoticeRequest),
        createdById: user.id, // 현재 로그인한 유저 ID 추가
      };

      await noticeService.createNotice(dataToSend);
      navigate("/admin/notices"); // 등록 성공 시 목록으로 이동
    } catch (err: unknown) {
      console.error("공지사항 생성 오류:", err);

      // ✅ 에러 해결: unknown 타입을 안전하게 캐스팅하여 메시지 추출
      const errorMessage =
        (err as any)?.response?.data?.message ||
        "공지사항 생성에 실패했습니다.";
      setSubmitError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <NoticeForm
      onSubmit={handleSubmit}
      loading={loading}
      submitError={submitError}
      isEditing={false} // 등록 모드
    />
  );
};

export default AddNoticePage;
