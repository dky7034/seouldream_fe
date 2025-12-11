import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type {
  PrayerDto,
  UpdatePrayerRequest,
  PrayerFormErrors,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { format } from "date-fns";

const EditPrayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prayer, setPrayer] = useState<PrayerDto | null>(null);
  const [formData, setFormData] = useState<UpdatePrayerRequest>({});
  const [formErrors, setFormErrors] = useState<PrayerFormErrors>({});
  const [selectedDate, setSelectedDate] = useState<string>(""); // 표시용

  useEffect(() => {
    // user 로딩 중이면 일단 대기
    if (!user) return;

    const fetchPrayerData = async () => {
      // ID 유효성 체크
      if (!id) {
        setError("유효하지 않은 기도제목 ID 입니다.");
        setIsFetching(false);
        return;
      }

      const prayerId = Number(id);
      if (Number.isNaN(prayerId)) {
        setError("유효하지 않은 기도제목 ID 입니다.");
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        const prayerData = await prayerService.getPrayerById(prayerId);

        // 권한 체크
        const isExecutive = user.role === "EXECUTIVE";
        const isOwner = user.id === prayerData.createdBy.id;
        const isCellLeader =
          user.role === "CELL_LEADER" &&
          user.cellId === prayerData.member.cell?.id;

        if (!isExecutive && !isOwner && !isCellLeader) {
          setError("이 기도제목을 수정할 권한이 없습니다.");
          setIsFetching(false);
          return;
        }

        setPrayer(prayerData);
        setFormData({
          content: prayerData.content,
          visibility: prayerData.visibility,
        });

        // 날짜는 "표시용"으로만 사용 (수정 불가)
        setSelectedDate(format(new Date(prayerData.createdAt), "yyyy-MM-dd"));
      } catch (err) {
        console.error(err);
        setError("기도제목 정보를 불러오는 데 실패했습니다.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchPrayerData();
  }, [id, user]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = (): PrayerFormErrors => {
    const newErrors: PrayerFormErrors = {};
    if (!formData.content?.trim()) {
      newErrors.content = "기도제목 내용은 필수입니다.";
    }
    // 날짜(selectedDate)는 수정 불가 + 항상 존재하는 값이므로 검증 X
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayer) return;

    setFormErrors({});
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // 날짜/주차는 수정하지 않음
      const payload: UpdatePrayerRequest = {
        ...formData,
        // createdAt, weekOfMonth 등은 보내지 않음 (불변)
      };

      await prayerService.updatePrayer(prayer.id, payload);
      navigate("/admin/prayers");
    } catch (err: any) {
      console.error(err);
      setFormErrors((prev) => ({
        ...prev,
        submit: err?.response?.data?.message || "기도제목 수정에 실패했습니다.",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  // auth 로딩 중
  if (!user) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
  }

  if (isFetching) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
  }

  if (error) {
    return <p className="mt-4 text-red-500">{error}</p>;
  }

  if (!prayer) {
    return (
      <p className="mt-4 text-red-600">기도제목 정보를 찾을 수 없습니다.</p>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">기도제목 수정</h1>
      <p className="mb-6 text-sm text-gray-500">
        기존 등록일:{" "}
        <span className="font-medium text-gray-800">
          {format(new Date(prayer.createdAt), "yyyy-MM-dd")}
        </span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formErrors.submit && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
            {formErrors.submit}
          </div>
        )}

        {/* 기도 대상 멤버 (읽기 전용) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            기도 대상 멤버 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            readOnly
            value={prayer.member.name}
            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm"
          />
        </div>

        {/* 날짜 (수정 불가) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            날짜
          </label>
          <input
            type="date"
            value={selectedDate}
            disabled
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 text-gray-700 cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">
            기도 날짜는 수정할 수 없습니다. 날짜가 잘못된 경우, 새 기도제목을
            다시 등록해 주세요.
          </p>
        </div>

        {/* 기도제목 내용 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            기도제목 내용 <span className="text-red-500">*</span>
          </label>
          <textarea
            name="content"
            rows={5}
            required
            value={formData.content || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
          {formErrors.content && (
            <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>
          )}
        </div>

        {/* 버튼 영역 - 반응형 정렬 */}
        <div className="flex flex-col space-y-2 pt-4 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPrayerPage;
