import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import type {
  PrayerDto,
  UpdatePrayerRequest,
  PrayerFormErrors,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import { format } from "date-fns"; // Import format from date-fns

const EditPrayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [prayer, setPrayer] = useState<PrayerDto | null>(null);
  const [formData, setFormData] = useState<UpdatePrayerRequest>({});
  const [formErrors, setFormErrors] = useState<PrayerFormErrors>({});
  const [selectedDate, setSelectedDate] = useState<string>(""); // State for the date input

  useEffect(() => {
    const fetchPrayerData = async () => {
      if (!id || !user) {
        setError("잘못된 접근입니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const prayerData = await prayerService.getPrayerById(Number(id));

        const isExecutive = user.role === "EXECUTIVE";
        const isOwner = user.id === prayerData.createdBy.id;
        const isCellLeader =
          user.role === "CELL_LEADER" &&
          user.cellId === prayerData.member.cell?.id;

        if (!isExecutive && !isOwner && !isCellLeader) {
          setError("이 기도제목을 수정할 권한이 없습니다.");
          setLoading(false);
          return;
        }

        setPrayer(prayerData);
        setFormData({
          content: prayerData.content,
          visibility: prayerData.visibility,
          // weekOfMonth는 날짜에서 계산되므로 여기서는 직접 설정하지 않음
        });
        setSelectedDate(format(new Date(prayerData.createdAt), "yyyy-MM-dd")); // Initialize with createdAt date
      } catch (err) {
        setError("기도제목 정보를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchPrayerData();
  }, [id, user, navigate]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
    setFormErrors((prev) => ({ ...prev, createdAt: undefined })); // Clear date error on change
  };

  const validateForm = (): PrayerFormErrors => {
    const newErrors: PrayerFormErrors = {};
    if (!formData.content?.trim())
      newErrors.content = "기도제목 내용은 필수입니다.";
    if (!selectedDate) newErrors.createdAt = "날짜는 필수입니다."; // Validate date field
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayer) return;

    setFormErrors({}); // Clear previous errors
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      // Calculate weekOfMonth from selectedDate
      const date = new Date(selectedDate);
      const weekOfMonth = Math.ceil(date.getDate() / 7);

      const payload: UpdatePrayerRequest = {
        ...formData,
        weekOfMonth, // Include weekOfMonth in the payload
      };

      await prayerService.updatePrayer(prayer.id, payload);
      navigate("/admin/prayers");
    } catch (err: any) {
      setFormErrors({
        submit: err.response?.data?.message || "기도제목 수정에 실패했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!prayer)
    return <p className="text-red-600">기도제목 정보를 찾을 수 없습니다.</p>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">기도제목 수정</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {formErrors.submit && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
            {formErrors.submit}
          </div>
        )}

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

        {/* 날짜 선택 필드 추가 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="selectedDate"
            required
            value={selectedDate}
            onChange={handleDateChange}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
          />
          {formErrors.createdAt && (
            <p className="mt-1 text-sm text-red-600">{formErrors.createdAt}</p>
          )}
        </div>

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

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-md"
            disabled={loading}
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditPrayerPage;
