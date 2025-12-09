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

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
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
    if (!formData.name) newErrors.name = "팀 이름은 필수입니다.";
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        {isEditing ? "팀 정보 수정" : "새 팀 추가"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white p-8 rounded-lg shadow-md"
      >
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
            {submitError}
          </div>
        )}

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
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
          )}
        </div>

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
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {isEditing && (
          <label htmlFor="active" className="flex items-center cursor-pointer">
            <span className="mr-3 text-sm font-medium text-gray-900">
              활성화 상태
            </span>
            <div className="relative">
              <input
                id="active"
                name="active"
                type="checkbox"
                className="sr-only"
                checked={(formData as UpdateTeamRequest).active || false}
                onChange={handleChange}
              />
              <div
                className={`block w-14 h-8 rounded-full ${
                  (formData as UpdateTeamRequest).active
                    ? "bg-indigo-600"
                    : "bg-gray-600"
                }`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                  (formData as UpdateTeamRequest).active ? "translate-x-6" : ""
                }`}
              ></div>
            </div>
          </label>
        )}

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

export default TeamForm;
