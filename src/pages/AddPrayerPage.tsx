import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService"; // Import cellService
import type {
  CreatePrayerRequest,
  PrayerFormErrors,
  MemberDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import { formatDisplayName } from "../utils/memberUtils";
import { format } from "date-fns"; // Import format from date-fns

const AddPrayerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState<
    Omit<CreatePrayerRequest, "weekOfMonth">
  >({
    memberId: user?.memberId || 0,
    content: "",
    visibility: "CELL",
    createdById: user?.id || 0,
  });

  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [formErrors, setFormErrors] = useState<PrayerFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      memberId: user.memberId ?? 0,
      createdById: user.id,
    }));

    const fetchMembers = async () => {
      setLoading(true);
      try {
        let memberData: MemberDto[] = [];
        if (user.role === "EXECUTIVE") {
          const allMembersPage = await memberService.getAllMembers({
            size: 1000,
          });
          memberData = allMembersPage.content;
        } else if (user.role === "CELL_LEADER" && user.cellId) {
          const cell = await cellService.getCellById(user.cellId);
          memberData = cell.members;
        }
        setMembers(memberData);
      } catch (err) {
        setSubmitError(
          "기도제목을 등록할 멤버 목록을 불러오는 데 실패했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    if (user.role === "EXECUTIVE" || user.role === "CELL_LEADER") {
      fetchMembers();
    }
  }, [user, navigate]);

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: formatDisplayName(m, members),
      })),
    [members]
  );

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMemberSelect = (memberId: number | undefined) => {
    if (memberId) {
      setFormData((prev) => ({ ...prev, memberId }));
    }
  };

  const validateForm = (): PrayerFormErrors => {
    const newErrors: PrayerFormErrors = {};
    if (!formData.content.trim())
      newErrors.content = "기도제목 내용은 필수입니다.";
    if (!selectedDate) newErrors.createdAt = "날짜는 필수입니다.";
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
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

      const payload: CreatePrayerRequest = {
        ...formData,
        weekOfMonth,
      };

      await prayerService.createPrayer(payload);
      navigate("/admin/prayers");
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || "기도제목 생성에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <p>로딩 중...</p>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        새 기도제목 추가
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border-red-400 rounded-md">
            {submitError}
          </div>
        )}

        {(user.role === "EXECUTIVE" || user.role === "CELL_LEADER") && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              기도 대상 멤버 <span className="text-red-500">*</span>
            </label>
            <SimpleSearchableSelect
              options={memberOptions}
              value={formData.memberId}
              onChange={(value) =>
                handleMemberSelect(
                  typeof value === "number" ? value : undefined
                )
              }
              placeholder="멤버를 선택하세요..."
            />
          </div>
        )}

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
            onChange={(e) => setSelectedDate(e.target.value)}
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
            value={formData.content}
            onChange={handleFormChange}
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

export default AddPrayerPage;
