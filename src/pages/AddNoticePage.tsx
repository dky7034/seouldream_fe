import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import type { CreateNoticeRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import NoticeForm, { type NoticeFormData } from "../components/NoticeForm"; // Import NoticeFormData

const AddNoticePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Redirect if not EXECUTIVE or user is null
  if (!user || user.role !== "EXECUTIVE") {
    navigate("/admin/notices"); // Redirect to notices list if not authorized
    return null;
  }

  const handleSubmit = async (formData: NoticeFormData) => {
    setLoading(true);
    setSubmitError(null);
    try {
      // isEditing이 false이므로, formData는 CreateNoticeRequest와 호환되어야 함.
      // createdById를 현재 user.id로 설정
      const dataToSend: CreateNoticeRequest = {
        ...(formData as CreateNoticeRequest),
        createdById: user.id,
      };
      
      await noticeService.createNotice(dataToSend);
      navigate("/admin/notices"); // Go back to notice list
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "공지사항 생성에 실패했습니다."
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