import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import type { NoticeDto, UpdateNoticeRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import NoticeForm from "../components/NoticeForm";

const EditNoticePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [editingNotice, setEditingNotice] = useState<NoticeDto | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setError("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    if (user.role !== "EXECUTIVE") {
      setError("공지사항을 수정할 권한이 없습니다.");
      setLoading(false);
      return;
    }

    const fetchNotice = async () => {
      try {
        setLoading(true);
        if (id) {
          const noticeData = await noticeService.getNoticeById(Number(id));
          setEditingNotice(noticeData);
        }
      } catch (err) {
        setError("공지사항 정보를 불러오는 데 실패했습니다.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotice();
  }, [id, user]);

  const handleSubmit = async (formData: UpdateNoticeRequest) => {
    setLoading(true);
    setSubmitError(null);
    if (!editingNotice) {
      setSubmitError("수정할 공지사항 정보를 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    try {
      await noticeService.updateNotice(editingNotice.id, formData);
      navigate("/admin/notices");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "공지사항 수정에 실패했습니다."
      );
      console.error("공지사항 수정 오류:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="mt-4 text-gray-600">로딩 중...</p>;
  }

  if (error) {
    return <p className="mt-4 text-red-600">{error}</p>;
  }

  if (!editingNotice) {
    return (
      <p className="mt-4 text-red-600">공지사항 정보를 찾을 수 없습니다.</p>
    );
  }

  const initialFormData: UpdateNoticeRequest = {
    title: editingNotice.title,
    content: editingNotice.content,
    target: editingNotice.target,
    targetCellId: editingNotice.targetCell?.id,
    pinned: editingNotice.pinned,
    publishAt: editingNotice.publishAt,
    expireAt: editingNotice.expireAt,
  };

  return (
    <NoticeForm
      initialData={initialFormData}
      onSubmit={handleSubmit}
      loading={loading}
      submitError={submitError}
      isEditing={true}
      createdAt={editingNotice.createdAt} // 🔹 작성일 전달
    />
  );
};

export default EditNoticePage;
