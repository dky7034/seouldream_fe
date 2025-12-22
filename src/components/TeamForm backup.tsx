import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type {
  CreateTeamRequest,
  UpdateTeamRequest,
  TeamFormErrors,
} from "../types";

type TeamFormData = CreateTeamRequest | UpdateTeamRequest;

interface TeamFormProps {
  initialData?: TeamFormData;
  onSubmit: (formData: TeamFormData) => Promise<void>;
  isEditing?: boolean;
  submitError: string | null;
  loading: boolean;
}

const TeamForm: React.FC<TeamFormProps> = ({
  initialData,
  onSubmit,
  isEditing = false,
  submitError,
  loading,
}) => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<TeamFormData>({
    name: "",
    description: "",
    ...initialData,
  });

  const [formErrors, setFormErrors] = useState<TeamFormErrors>({});

  // initialData 변경 시에도 기본값을 유지하면서 머지
  useEffect(() => {
    if (initialData) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = () => {
    const newErrors: TeamFormErrors = {};
    if (!formData.name || !formData.name.trim()) {
      newErrors.name = "팀 이름은 필수입니다.";
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

  const isActive = (formData as UpdateTeamRequest).active ?? false;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* 헤더 */}
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">
        {isEditing ? "팀 정보 수정" : "새 팀 추가"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100"
      >
        {/* 에러 메시지 */}
        {submitError && (
          <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {/* 팀 이름 */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700"
          >
            팀 이름 <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {formErrors.name && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.name}
            </p>
          )}
        </div>

        {/* 설명 */}
        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700"
          >
            설명
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* 활성화 토글 (수정 모드에서만 표시) */}
        {isEditing && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label
              htmlFor="active"
              className={`flex items-center ${
                loading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
              }`}
            >
              <span className="mr-3 text-sm font-medium text-gray-900">
                활성화 상태
              </span>
              <div className="relative">
                <input
                  id="active"
                  name="active"
                  type="checkbox"
                  className="sr-only"
                  checked={isActive}
                  onChange={handleChange}
                  disabled={loading}
                />
                <div
                  role="switch"
                  aria-checked={isActive}
                  aria-label="팀 활성화 상태"
                  className={`block w-14 h-8 rounded-full transition-colors ${
                    isActive ? "bg-indigo-600" : "bg-gray-600"
                  }`}
                ></div>
                <div
                  className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full shadow-sm transition-transform ${
                    isActive ? "translate-x-6" : ""
                  }`}
                ></div>
              </div>
            </label>
            <p className="text-xs text-gray-500">
              비활성화된 팀은 기본 목록에서 숨길 수 있습니다.
            </p>
          </div>
        )}

        {/* 버튼 영역: 모바일=세로, 데스크탑=우측 정렬 */}
        <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium tracking-wide text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-60"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium tracking-wide text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? "저장 중..." : isEditing ? "수정 완료" : "추가"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamForm;
