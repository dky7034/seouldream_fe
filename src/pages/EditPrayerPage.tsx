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
// ✅ KoreanCalendarPicker import
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";

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

  // 수정용 날짜 State
  const [selectedDate, setSelectedDate] = useState<string>("");

  useEffect(() => {
    if (!user) return;

    const fetchPrayerData = async () => {
      if (!id || Number.isNaN(Number(id))) {
        setError("유효하지 않은 기도제목 ID 입니다.");
        setIsFetching(false);
        return;
      }

      setIsFetching(true);
      try {
        const prayerData = await prayerService.getPrayerById(Number(id));

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

        // meetingDate를 초기값으로 설정 (없으면 createdAt Fallback)
        setSelectedDate(
          prayerData.meetingDate ||
            format(new Date(prayerData.createdAt), "yyyy-MM-dd")
        );
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
    if (!selectedDate) {
      newErrors.createdAt = "날짜는 필수입니다.";
    }
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
      const payload: UpdatePrayerRequest = {
        ...formData,
        meetingDate: selectedDate, // 수정된 날짜 전송
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

  if (!user || isFetching) {
    return (
      <p className="mt-4 text-gray-600">
        로딩 중입니다. 잠시만 기다려 주세요...
      </p>
    );
  }

  if (error) return <p className="mt-4 text-red-500">{error}</p>;
  if (!prayer) return <p className="mt-4 text-red-600">정보 없음</p>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">기도제목 수정</h1>
      <p className="mb-6 text-sm text-gray-500">
        작성자:{" "}
        <span className="font-medium text-gray-800">
          {prayer.createdBy.name}
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
            기도 대상 멤버
          </label>
          <input
            type="text"
            readOnly
            value={prayer.member.name}
            className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm text-gray-600 cursor-not-allowed"
          />
        </div>

        {/* ✅ 모임 날짜 (KoreanCalendarPicker 적용) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            모임(기도제목 작성) 날짜 <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <KoreanCalendarPicker
              value={selectedDate}
              onChange={setSelectedDate}
              placeholder="날짜를 선택하세요"
              // 필요하다면 미래 날짜 선택 방지: maxDate={new Date()}
            />
          </div>
          {formErrors.createdAt && (
            <p className="mt-1 text-sm text-red-600">{formErrors.createdAt}</p>
          )}
          {/* <p className="mt-1 text-xs text-gray-500">
            실제 셀모임을 진행한 날짜로 수정할 수 있습니다.
          </p> */}
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
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {formErrors.content && (
            <p className="mt-1 text-sm text-red-600">{formErrors.content}</p>
          )}
        </div>

        <div className="flex flex-col space-y-2 pt-4 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-60"
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
