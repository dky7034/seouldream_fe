import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { memberService } from "../services/memberService";
import { teamService } from "../services/teamService";
import { cellService } from "../services/cellService";
import type {
  UpdateMemberRequest,
  FormErrors,
  TeamDto,
  CellDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import MultiSelect from "../components/MultiSelect";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
// ✅ KoreanCalendarPicker import (경로는 프로젝트 구조에 맞게 조정해주세요)
import KoreanCalendarPicker from "../components/KoreanCalendarPicker";

const EditMemberPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [error, setError] = useState<string | null>(null);
  const [originalMemberName, setOriginalMemberName] = useState<string>("");
  const [formData, setFormData] = useState<UpdateMemberRequest>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [cells, setCells] = useState<CellDto[]>([]);
  const [allTeams, setAllTeams] = useState<TeamDto[]>([]);
  const [memberTeams, setMemberTeams] = useState<TeamDto[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [originalCellId, setOriginalCellId] = useState<number | undefined>();

  const isExecutive = user?.role === "EXECUTIVE";

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("멤버 ID가 제공되지 않았습니다.");
        setIsFetching(false);
        return;
      }

      const memberIdNum = Number(id);
      if (Number.isNaN(memberIdNum)) {
        setError("유효하지 않은 멤버 ID 입니다.");
        setIsFetching(false);
        return;
      }

      if (!user) {
        setError("로그인이 필요합니다.");
        setIsFetching(false);
        return;
      }

      if (!isExecutive && user.memberId !== memberIdNum) {
        setError("멤버 정보를 수정할 권한이 없습니다.");
        setIsFetching(false);
        return;
      }

      try {
        setIsFetching(true);

        const [memberData, allTeamsPage, memberTeamsData, allCellsPage] =
          await Promise.all([
            memberService.getMemberById(memberIdNum),
            teamService.getAllTeams({}),
            memberService.getMemberTeams(memberIdNum),
            cellService.getAllCells({}),
          ]);

        setOriginalMemberName(memberData.name);
        const currentCellId = memberData.cell?.id;
        setOriginalCellId(currentCellId);

        setFormData({
          name: memberData.name,
          gender: memberData.gender,
          birthDate: memberData.birthDate,
          phone: memberData.phone,
          email: memberData.email,
          cellId: currentCellId,
          role: memberData.role,
          joinYear: memberData.joinYear,
          active: memberData.active,
          address: memberData.address,
          note: memberData.note,
        });

        setAllTeams(allTeamsPage.content);
        setMemberTeams(memberTeamsData);
        setSelectedTeamIds(memberTeamsData.map((team) => team.id));
        setCells(allCellsPage.content.filter((c) => c.active));
      } catch (err) {
        console.error(err);
        setError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [id, user, isExecutive]);

  const cellOptions = useMemo(
    () => cells.map((c) => ({ value: c.id, label: c.name })),
    [cells]
  );

  const teamOptions = useMemo(
    () => allTeams.map((t) => ({ value: t.id, label: t.name })),
    [allTeams]
  );

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "joinYear" ? Number(value) : value,
    }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // ✅ 생년월일 달력 변경 핸들러
  const handleBirthDateChange = (dateString: string) => {
    setFormData((prev) => ({ ...prev, birthDate: dateString }));
    setFormErrors((prev) => ({ ...prev, birthDate: undefined }));
  };

  const handleCellSelect = (cellId: number | undefined) => {
    setFormData((prev) => ({ ...prev, cellId }));
    setFormErrors((prev) => ({ ...prev, cellId: undefined }));
  };

  const handleToggleChange = () => {
    if (!isExecutive) return;
    setFormData((prev) => ({ ...prev, active: !prev.active }));
  };

  const handleTeamChange = (selectedIds: number[]) => {
    setSelectedTeamIds(selectedIds);
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    if (!formData.name) newErrors.name = "이름은 필수입니다.";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email || "")) {
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    }
    if (!formData.phone) {
      newErrors.phone = "연락처는 필수입니다.";
    } else if (!/^\d+$/.test(formData.phone)) {
      newErrors.phone = "연락처는 숫자만 입력해 주세요.";
    }
    if (!formData.birthDate) {
      newErrors.birthDate = "생년월일은 필수입니다.";
    }

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const memberIdNum = Number(id);
      const { cellId: currentCellId, email, ...otherData } = formData;
      const normalizedEmail =
        typeof email === "string" && email.trim() === "" ? undefined : email;

      let cellIdToSend: number | undefined = undefined;

      if (isExecutive) {
        if (currentCellId === undefined) {
          if (originalCellId != null) {
            cellIdToSend = 0;
          } else {
            cellIdToSend = undefined;
          }
        } else {
          if (currentCellId !== originalCellId) {
            cellIdToSend = currentCellId;
          } else {
            cellIdToSend = undefined;
          }
        }
      }

      const payload: UpdateMemberRequest = {
        ...otherData,
        ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        ...(isExecutive && cellIdToSend !== undefined
          ? { cellId: cellIdToSend }
          : {}),
      };

      await memberService.updateMember(memberIdNum, payload);

      if (isExecutive) {
        const currentTeamIds = new Set(memberTeams.map((team) => team.id));
        const newTeamIds = new Set(selectedTeamIds);

        const teamsToRemove = Array.from(currentTeamIds).filter(
          (teamId) => !newTeamIds.has(teamId)
        );
        const teamsToAdd = Array.from(newTeamIds).filter(
          (teamId) => !currentTeamIds.has(teamId)
        );

        for (const teamId of teamsToRemove) {
          await memberService.removeMemberFromTeam(memberIdNum, teamId);
        }
        for (const teamId of teamsToAdd) {
          await memberService.addMemberToTeam(memberIdNum, teamId);
        }
      }

      if (isExecutive) {
        navigate("/admin/users");
      } else {
        navigate(-1);
      }
    } catch (err: any) {
      console.error(err);
      setFormErrors({
        submit: err.response?.data?.message || "멤버 수정에 실패했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetching) {
    return <p className="mt-4 text-gray-600">로딩 중...</p>;
  }

  if (error) {
    return <p className="mt-4 text-red-600">{error}</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        멤버 수정: {originalMemberName}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        {formErrors.submit && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
            {formErrors.submit}
          </div>
        )}

        {/* 개인 정보 */}
        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
            개인 정보
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                name="name"
                type="text"
                required
                value={formData.name || ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>

            {/* 이메일 (선택) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                이메일
              </label>
              <input
                name="email"
                type="email"
                value={formData.email || ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>

            {/* 연락처 - ✅ UI 개선: placeholder 단순화 및 helper text 추가 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                name="phone"
                type="tel"
                required
                value={formData.phone || ""}
                onChange={handleFormChange}
                placeholder="01012345678"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              {/* ✅ 모바일에서 잘리지 않도록 입력창 아래에 별도 문구로 배치 */}
              <p className="mt-1 text-xs text-gray-500">
                하이픈(-) 없이 숫자만 입력해 주세요.
              </p>
              {formErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
              )}
            </div>

            {/* 주소 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                주소
              </label>
              <input
                name="address"
                type="text"
                value={formData.address || ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
            </div>

            {/* 성별 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                성별 <span className="text-red-500">*</span>
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              >
                <option value="MALE">남성</option>
                <option value="FEMALE">여성</option>
              </select>
            </div>

            {/* 생년월일 - ✅ KoreanCalendarPicker 적용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <KoreanCalendarPicker
                  value={formData.birthDate || ""}
                  onChange={handleBirthDateChange}
                  placeholder="생년월일을 선택하세요"
                  // 생일은 과거 날짜 전체가 가능하므로 minDate/maxDate 제한을 두지 않거나 적절히 조정
                  // maxDate={new Date()} // 미래 날짜 방지 필요 시 주석 해제
                />
              </div>
              {formErrors.birthDate && (
                <p className="mt-1 text-sm text-red-600">
                  {formErrors.birthDate}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {/* 교회 정보 */}
        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
            교회 정보
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 셀 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                셀
              </label>
              <div className="mt-1">
                <SimpleSearchableSelect
                  options={cellOptions}
                  value={formData.cellId}
                  onChange={(value) =>
                    handleCellSelect(
                      typeof value === "number" ? value : undefined
                    )
                  }
                  placeholder="셀을 선택하세요..."
                  isDisabled={!isExecutive}
                />
              </div>
              {!isExecutive && (
                <p className="mt-1 text-sm text-gray-500">
                  셀 변경은 임원만 가능합니다.
                </p>
              )}
              {formErrors.cellId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.cellId}</p>
              )}
            </div>

            {/* 역할 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                역할 <span className="text-red-500">*</span>
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                disabled={!isExecutive}
              >
                <option value="MEMBER">셀원</option>
                <option value="CELL_LEADER">셀장</option>
                <option value="EXECUTIVE">임원</option>
              </select>
              {!isExecutive && (
                <p className="mt-1 text-sm text-gray-500">
                  역할 변경은 임원만 가능합니다.
                </p>
              )}
            </div>

            {/* 등록 연도 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                등록 연도 <span className="text-red-500">*</span>
              </label>
              <input
                name="joinYear"
                type="number"
                value={formData.joinYear ?? ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                disabled={!isExecutive}
              />
            </div>

            {/* 활성 상태 */}
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-700">
                활성 상태
              </span>
              <button
                type="button"
                onClick={handleToggleChange}
                disabled={!isExecutive}
                className={`${
                  formData.active ? "bg-indigo-600" : "bg-gray-200"
                } relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                  !isExecutive ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span
                  className={`${
                    formData.active ? "translate-x-6" : "translate-x-1"
                  } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
                />
              </button>
            </div>
          </div>
        </fieldset>

        {/* 팀 소속 - EXECUTIVE 전용 */}
        {isExecutive && (
          <fieldset className="space-y-4 p-4 border rounded-md">
            <legend className="text-lg font-medium text-gray-900 px-2">
              팀 소속
            </legend>
            <MultiSelect
              options={teamOptions}
              selectedValues={selectedTeamIds}
              onChange={handleTeamChange}
            />
          </fieldset>
        )}

        {/* 버튼 */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-4">
          <button
            type="button"
            onClick={() =>
              isExecutive ? navigate("/admin/users") : navigate(-1)
            }
            className="w-full sm:w-auto bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditMemberPage;
