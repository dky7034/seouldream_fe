import React, { useEffect, useState, useMemo } from "react";
// import { cellService } from "../services/cellService"; // ❌ cells 미사용으로 주석 처리
import type {
  CreateNoticeRequest,
  UpdateNoticeRequest,
  // CellDto, // ❌ 미사용 주석 처리
  NoticeFormErrors,
} from "../types";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export type NoticeFormData = CreateNoticeRequest | UpdateNoticeRequest;

interface NoticeFormProps {
  initialData?: NoticeFormData;
  onSubmit: (formData: NoticeFormData) => Promise<void>;
  isEditing?: boolean;
  submitError: string | null;
  loading: boolean;
  createdAt?: string;
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
  // const { user } = useAuth(); // ❌ user도 fetchCells에서만 썼다면 주석 처리 가능 (현재는 안 쓰임)

  const [formData, setFormData] = useState<NoticeFormData>(
    initialData ?? {
      title: "",
      content: "",
      target: "ALL",
      pinned: false,
    }
  );

  // ❌ [오류 1 해결] 사용하지 않는 cells 상태 및 관련 useEffect 삭제/주석
  // const [cells, setCells] = useState<CellDto[]>([]);

  const [formErrors, setFormErrors] = useState<NoticeFormErrors>({});

  const todayLabel = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // ❌ [오류 1 해결] cells 로딩 로직 삭제/주석
  // useEffect(() => {
  //   const fetchCells = async () => {
  //     try {
  //       const allCells = await cellService.getAllCells({});
  //       setCells(allCells.content);
  //     } catch (err) {
  //       console.error("Failed to fetch cells for dropdowns:", err);
  //     }
  //   };
  //   if (user?.role === "EXECUTIVE") {
  //     fetchCells();
  //   }
  // }, [user]);

  // ✅ [오류 2 해결] 초기화 로직 개선
  // initialData가 변경되었을 때만(예: 데이터 로딩 완료 후) 폼을 업데이트합니다.
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => {
        // 기존 데이터와 다를 때만 업데이트하여 불필요한 렌더링 방지
        if (JSON.stringify(prev) !== JSON.stringify(initialData)) {
          return initialData;
        }
        return prev;
      });
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      {/* 헤더 영역 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {isEditing ? "공지사항 수정" : "새 공지사항 추가"}
        </h1>

        {!isEditing && (
          <p className="mt-2 text-xs sm:text-sm text-gray-500">
            오늘 작성 기준 날짜:{" "}
            <span className="font-medium text-gray-800">{todayLabel}</span>
          </p>
        )}
        {isEditing && createdAt && (
          <p className="mt-2 text-xs sm:text-sm text-gray-500">
            공지 작성일:{" "}
            <span className="font-medium text-gray-800">
              {format(new Date(createdAt), "yyyy-MM-dd")}
            </span>
          </p>
        )}
      </div>

      {/* 카드 레이아웃 */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-5 sm:space-y-6"
      >
        {submitError && (
          <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {/* 제목 */}
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
            className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {formErrors.title && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.title}
            </p>
          )}
        </div>

        {/* 내용 */}
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
            rows={7}
            required
            value={formData.content}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {formErrors.content && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.content}
            </p>
          )}
        </div>

        {/* 공지 대상 + 대상 셀 (주석 처리됨) */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
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
              className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="ALL">전체</option>
              <option value="CELL_LEADER">셀장</option>
              <option value="EXECUTIVE">임원</option>
              <option value="CELL">특정 셀</option>
            </select>
            {formErrors.target && (
              <p className="mt-1 text-xs sm:text-sm text-red-600">
                {formErrors.target}
              </p>
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
                className="mt-1 block w-full px-3 py-2.5 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">셀을 선택하세요</option>
                {cells.map((cell) => (
                  <option key={cell.id} value={cell.id}>
                    {cell.name}
                  </option>
                ))}
              </select>
              {formErrors.targetCellId && (
                <p className="mt-1 text-xs sm:text-sm text-red-600">
                  {formErrors.targetCellId}
                </p>
              )}
            </div>
          )}
        </div> */}

        {/* ✅ 상단 고정 스위치 – 카드 안, 좌우 정렬 */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">상단 고정</span>
          <label
            htmlFor="pinned"
            className="flex items-center cursor-pointer select-none"
          >
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
                className={`block w-11 h-6 rounded-full transition-colors ${
                  formData.pinned ? "bg-indigo-600" : "bg-gray-400"
                }`}
              />
              <div
                className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${
                  formData.pinned ? "translate-x-5" : ""
                }`}
              />
            </div>
          </label>
        </div>

        {/* 게시 기간 설정 (주석 처리됨) */}
        {/* ... (생략된 주석 코드) ... */}

        {/* 버튼 영역 */}
        <div className="pt-3 sm:pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-60"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
