import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { noticeService } from "../services/noticeService";
import type { NoticeDto, UpdateNoticeRequest } from "../types";
import { useAuth } from "../hooks/useAuth";
import NoticeForm, { type NoticeFormData } from "../components/NoticeForm";

const EditNoticePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNotice, setEditingNotice] = useState<NoticeDto | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    // user 정보가 아직 없는 경우: auth 로딩 중일 수 있으니 대기
    if (!user) return;

    // EXECUTIVE가 아니면 공지 수정 페이지 접근 불가 → 목록으로 돌려보내기
    if (user.role !== "EXECUTIVE") {
      navigate("/admin/notices");
      return;
    }

    const fetchNotice = async () => {
      // id 유효성 체크
      if (!id) {
        setError("유효하지 않은 공지사항 ID 입니다.");
        setIsFetching(false);
        return;
      }

      const noticeId = Number(id);
      if (Number.isNaN(noticeId)) {
        setError("유효하지 않은 공지사항 ID 입니다.");
        setIsFetching(false);
        return;
      }

      try {
        setIsFetching(true);
        const noticeData = await noticeService.getNoticeById(noticeId);
        setEditingNotice(noticeData);
      } catch (err) {
        console.error(err);
        setError("공지사항 정보를 불러오는 데 실패했습니다.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchNotice();
  }, [id, user, navigate]);

  const handleSubmit = async (formData: NoticeFormData) => {
    if (!editingNotice) {
      setSubmitError("수정할 공지사항 정보를 찾을 수 없습니다.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await noticeService.updateNotice(
        editingNotice.id,
        formData as UpdateNoticeRequest
      );
      navigate("/admin/notices");
    } catch (err: any) {
      console.error("공지사항 수정 오류:", err);
      setSubmitError(
        err?.response?.data?.message || "공지사항 수정에 실패했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // auth 로딩 중 (user 아직 null)
  if (!user) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
  }

  // EXECUTIVE가 아니면 useEffect에서 이미 navigate 중이므로 여기서는 렌더 막기
  if (user.role !== "EXECUTIVE") {
    return null;
  }

  if (isFetching) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
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
      loading={isSubmitting}
      submitError={submitError}
      isEditing={true}
      createdAt={editingNotice.createdAt}
    />
  );
};

export default EditNoticePage;
