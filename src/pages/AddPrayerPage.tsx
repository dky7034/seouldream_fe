import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { prayerService } from "../services/prayerService";
import { memberService } from "../services/memberService";
import { cellService } from "../services/cellService";
import type {
  CreatePrayerRequest,
  PrayerFormErrors,
  MemberDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import { formatDisplayName } from "../utils/memberUtils";
import { format } from "date-fns";

const AddPrayerPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState<
    Omit<CreatePrayerRequest, "weekOfMonth" | "meetingDate"> // meetingDate는 별도 state로 관리
  >({
    memberId: 0,
    content: "",
    visibility: "CELL",
    createdById: 0,
  });

  // ✅ 기본값: 오늘 날짜
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd")
  );

  const [members, setMembers] = useState<MemberDto[]>([]);
  const [formErrors, setFormErrors] = useState<PrayerFormErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayLabel = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  const isExecutiveOrLeader =
    user && (user.role === "EXECUTIVE" || user.role === "CELL_LEADER");

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      memberId: user.memberId ?? 0,
      createdById: user.id,
      visibility: prev.visibility || "CELL",
    }));

    const fetchMembers = async () => {
      if (!isExecutiveOrLeader) return;

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
        console.error(err);
        setSubmitError(
          "기도제목을 등록할 멤버 목록을 불러오는 데 실패했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [user, navigate, isExecutiveOrLeader]);

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
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleMemberSelect = (memberId: number | undefined) => {
    setFormData((prev) => ({
      ...prev,
      memberId: memberId ?? 0,
    }));
    setFormErrors((prev) => ({ ...prev, memberId: undefined }));
  };

  const validateForm = (): PrayerFormErrors => {
    const newErrors: PrayerFormErrors = {};

    if (!formData.content.trim()) {
      newErrors.content = "기도제목 내용은 필수입니다.";
    }

    if (!selectedDate) {
      // DTO 상 meetingDate가 필수
      newErrors.createdAt = "날짜는 필수입니다.";
    }

    if (isExecutiveOrLeader && (!formData.memberId || formData.memberId <= 0)) {
      newErrors.memberId = "기도 대상 멤버를 선택해 주세요.";
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setFormErrors({});

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setLoading(true);

    try {
      const date = new Date(selectedDate);
      const weekOfMonth = Math.ceil(date.getDate() / 7);

      // ✅ [수정] meetingDate 필드 포함하여 전송
      const payload: CreatePrayerRequest = {
        ...formData,
        meetingDate: selectedDate, // 필수 필드
        weekOfMonth, // 백엔드 로직에 따라 선택사항 (DTO에 있다면 포함)
      };

      await prayerService.createPrayer(payload);
      navigate("/admin/prayers");
    } catch (err: any) {
      console.error(err);
      setSubmitError(
        err?.response?.data?.message || "기도제목 생성에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          사용자 정보를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          새 기도제목 추가
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-gray-500">
          오늘 기준 날짜:{" "}
          <span className="font-medium text-gray-800">{todayLabel}</span>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6"
      >
        {submitError && (
          <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {!isExecutiveOrLeader && (
          <div className="p-3 rounded-md bg-indigo-50 border border-indigo-100 text-xs sm:text-sm text-gray-700">
            <p className="font-medium">
              기도 대상: <span className="text-indigo-700">{user.name}</span>
            </p>
            <p className="mt-1">셀원은 본인 기도제목만 등록할 수 있습니다.</p>
          </div>
        )}

        {isExecutiveOrLeader && (
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
              isDisabled={loading}
            />
            {formErrors.memberId && (
              <p className="mt-1 text-xs sm:text-sm text-red-600">
                {formErrors.memberId}
              </p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            모임(기도) 날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="selectedDate"
            required
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setFormErrors((prev) => ({ ...prev, createdAt: undefined }));
            }}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          />
          {formErrors.createdAt && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.createdAt}
            </p>
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
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            disabled={loading}
          />
          {formErrors.content && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.content}
            </p>
          )}
        </div>

        <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-60"
            disabled={loading}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-60"
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
