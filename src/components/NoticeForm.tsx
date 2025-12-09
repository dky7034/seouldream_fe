import React, { useEffect, useState, useMemo } from "react";
import { cellService } from "../services/cellService";
import type {
  CreateNoticeRequest,
  UpdateNoticeRequest,
  CellDto,
  NoticeFormErrors,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export type NoticeFormData = CreateNoticeRequest | UpdateNoticeRequest;

interface NoticeFormProps {
  initialData?: NoticeFormData;
  onSubmit: (formData: NoticeFormData) => Promise<void>;
  isEditing?: boolean;
  submitError: string | null;
  loading: boolean;
  createdAt?: string; // ✅ 추가: 공지 작성일(수정 페이지용)
}

const NoticeForm: React.FC<NoticeFormProps> = ({
  initialData,
  onSubmit,
  isEditing = false,
  submitError,
  loading,
  createdAt,
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ✅ createdById는 여기서 다루지 않습니다.
  const [formData, setFormData] = useState<NoticeFormData>(
    initialData ?? {
      title: "",
      content: "",
      target: "ALL",
      pinned: false,
    }
  );

  const [cells, setCells] = useState<CellDto[]>([]);
  const [formErrors, setFormErrors] = useState<NoticeFormErrors>({});

  const todayLabel = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  useEffect(() => {
    const fetchCells = async () => {
      try {
        const allCells = await cellService.getAllCells({});
        setCells(allCells.content);
      } catch (err) {
        console.error("Failed to fetch cells for dropdowns:", err);
      }
    };

    if (user?.role === "EXECUTIVE") {
      fetchCells();
    }
  }, [user]);

  // ✅ initialData 변경 시에만 formData 동기화 (createdById 안 건드림)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => {
      const newFormData = { ...prev } as any;

      if (type === "checkbox") {
        newFormData[name] = checked;
      } else if (name === "targetCellId") {
        newFormData[name] = value === "" ? undefined : Number(value);
      } else if (name === "publishAt" || name === "expireAt") {
        newFormData[name] = value === "" ? undefined : value;
      } else {
        newFormData[name] = value;
      }

      // 대상이 CELL가 아니면 targetCellId 제거
      if (name === "target" && value !== "CELL") {
        delete newFormData.targetCellId;
      }

      return newFormData as NoticeFormData;
    });
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = () => {
    const newErrors: NoticeFormErrors = {};
    if (!formData.title) newErrors.title = "제목은 필수입니다.";
    if (!formData.content) newErrors.content = "내용은 필수입니다.";
    if (!formData.target) newErrors.target = "공지 대상은 필수입니다.";

    if (
      formData.target === "CELL" &&
      !(formData as CreateNoticeRequest).targetCellId
    ) {
      newErrors.targetCellId = "셀 대상 공지 시 대상 셀은 필수입니다.";
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }
    await onSubmit(formData);
  };

  const formatDateTimeForInput = (date: string | Date | undefined): string => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const pad = (num: number) => num.toString().padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {isEditing ? "공지사항 수정" : "새 공지사항 추가"}
      </h1>

      {/* ✅ 새 공지 추가 시: 오늘 날짜 안내 */}
      {!isEditing && (
        <p className="mb-6 text-sm text-gray-500">
          오늘 작성 기준 날짜:{" "}
          <span className="font-medium text-gray-800">{todayLabel}</span>
        </p>
      )}

      {/* ✅ 수정 모드일 때: 기존 공지 작성일 표시 */}
      {isEditing && createdAt && (
        <p className="mb-6 text-sm text-gray-500">
          공지 작성일:{" "}
          <span className="font-medium text-gray-800">
            {format(new Date(createdAt), "yyyy-MM-dd")}
          </span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md mb-4">
            {submitError}
          </div>
        )}

        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700"
          >
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            value={formData.title}
            onChange={handleChange}
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {formErrors.title && (
            <p className="mt-1 text-sm text-red-600">{formErrors.title}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="content"
            className="block text-sm font-medium text-gray-700"
          >
            내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="content"
            name="content"
            rows={8}
            required
            value={formData.content}
            onChange={handleChange}
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {formErrors.content && (
            <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="target"
              className="block text-sm font-medium text-gray-700"
            >
              공지 대상 <span className="text-red-500">*</span>
            </label>
            <select
              id="target"
              name="target"
              required
              value={formData.target}
              onChange={handleChange}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="ALL">전체</option>
              <option value="CELL_LEADER">셀장</option>
              <option value="EXECUTIVE">임원</option>
              <option value="CELL">특정 셀</option>
            </select>
            {formErrors.target && (
              <p className="mt-1 text-sm text-red-600">{formErrors.target}</p>
            )}
          </div>

          {formData.target === "CELL" && (
            <div>
              <label
                htmlFor="targetCellId"
                className="block text-sm font-medium text-gray-700"
              >
                대상 셀
              </label>
              <select
                id="targetCellId"
                name="targetCellId"
                value={(formData as CreateNoticeRequest).targetCellId || ""}
                onChange={handleChange}
                className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="">셀을 선택하세요</option>
                {cells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              {formErrors.targetCellId && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.targetCellId}
                </p>
              )}
            </div>
          )}
        </div>

        <label htmlFor="pinned" className="flex items-center cursor-pointer">
          <span className="mr-3 text-sm font-medium text-gray-900">
            상단 고정
          </span>
          <div className="relative">
            <input
              id="pinned"
              name="pinned"
              type="checkbox"
              className="sr-only"
              checked={formData.pinned || false}
              onChange={handleChange}
            />
            <div
              className={`block w-14 h-8 rounded-full ${
                formData.pinned ? "bg-indigo-600" : "bg-gray-600"
              }`}
            ></div>
            <div
              className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                formData.pinned ? "translate-x-6" : ""
              }`}
            ></div>
          </div>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="publishAt"
              className="block text-sm font-medium text-gray-700"
            >
              게시 시작 시각 (선택)
            </label>
            <input
              id="publishAt"
              name="publishAt"
              type="datetime-local"
              value={formatDateTimeForInput(
                (formData as CreateNoticeRequest).publishAt
              )}
              onChange={handleChange}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="expireAt"
              className="block text-sm font-medium text-gray-700"
            >
              게시 종료 시각 (선택)
            </label>
            <input
              id="expireAt"
              name="expireAt"
              type="datetime-local"
              value={formatDateTimeForInput(
                (formData as CreateNoticeRequest).expireAt
              )}
              onChange={handleChange}
              className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 space-x-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 font-medium tracking-wide text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="px-4 py-2 font-medium tracking-wide text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={loading}
          >
            {loading ? "저장 중..." : isEditing ? "수정 완료" : "추가"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NoticeForm;
