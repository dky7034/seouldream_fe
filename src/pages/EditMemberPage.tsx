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

      // EXECUTIVE가 아니면서 본인(memberId)도 아니면 수정 불가
      if (!isExecutive && user.memberId !== memberIdNum) {
        setError("사용자 정보를 수정할 권한이 없습니다.");
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
          email: memberData.email, // ✅ 선택 입력으로 유지
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

    // ✅ 이메일: 비어 있으면 통과, 값이 있으면 형식만 검사
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

    // ✅ 셀장 셀 필수 제한 제거 (프론트에서 더 이상 막지 않음)

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

      // ✅ formData에서 cellId, email 분리 (이메일은 제출 직전에 정규화)
      const { cellId: currentCellId, email, ...otherData } = formData;

      // ✅ 이메일 정규화: "" / 공백만 → undefined (필드 자체를 안 보냄)
      const normalizedEmail =
        typeof email === "string" && email.trim() === "" ? undefined : email;

      /**
       * 백엔드 규칙에 맞게 보낼 cellId 결정
       * undefined → 필드 자체를 안 보냄 (셀 변경 없음)
       * 0 → 셀 배정 해제
       * 양의 숫자 → 해당 셀로 배정/변경
       */
      let cellIdToSend: number | undefined = undefined;

      if (isExecutive) {
        if (currentCellId === undefined) {
          // 폼에서 셀 선택이 비어 있는 상태
          if (originalCellId != null) {
            // 원래는 셀이 있었는데 지금은 비워짐 → "배정 해제" 의도
            cellIdToSend = 0;
          } else {
            // 원래도 셀 없었고 지금도 없음 → 셀 변경 없음
            cellIdToSend = undefined;
          }
        } else {
          // 폼에 셀 ID가 선택되어 있는 상태
          if (currentCellId !== originalCellId) {
            // 다른 셀로 변경됨 → 새 셀로 배정
            cellIdToSend = currentCellId;
          } else {
            // 셀 선택이 변경되지 않음 → 셀 변경 없음
            cellIdToSend = undefined;
          }
        }
      }

      // ✅ payload: email은 normalizedEmail이 있을 때만 포함 (키 자체 제외)
      const payload: UpdateMemberRequest = {
        ...otherData,
        ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
        ...(isExecutive && cellIdToSend !== undefined
          ? { cellId: cellIdToSend }
          : {}),
      };

      console.log("UPDATE MEMBER PAYLOAD:", payload);

      // 1. 멤버 정보 + (필요 시) 셀 정보까지 한 번에 업데이트
      await memberService.updateMember(memberIdNum, payload);

      // 2. 팀 소속 변경 (EXECUTIVE만)
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

      // 3. 역할에 따른 이동
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

  // 초기 데이터 로딩 중
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

            {/* 연락처 */}
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
                placeholder="숫자만 입력해 주세요 (예: 01012345678)"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
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

            {/* 생년월일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <input
                name="birthDate"
                type="date"
                required
                value={formData.birthDate || ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
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
            {/* 셀 (✅ 셀장이어도 수정 가능 / ✅ 임원만 수정 가능) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                셀
              </label>

              {/* ▼ 여기에 div로 감싸고 mt-1 클래스를 추가했습니다 ▼ */}
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
              {/* ▲ 추가 끝 ▲ */}

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

          {/* 메모 */}
          {/* <div>
            <label className="block text-sm font-medium text-gray-700">
              메모
            </label>
            <textarea
              name="note"
              rows={3}
              value={formData.note || ""}
              onChange={handleFormChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
            />
          </div> */}
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
