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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [originalMemberName, setOriginalMemberName] = useState<string>("");
  const [formData, setFormData] = useState<UpdateMemberRequest>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [cells, setCells] = useState<CellDto[]>([]);
  const [allTeams, setAllTeams] = useState<TeamDto[]>([]);
  const [memberTeams, setMemberTeams] = useState<TeamDto[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [originalCellId, setOriginalCellId] = useState<number | undefined>();
  const [isCellLeader, setIsCellLeader] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError("멤버 ID가 제공되지 않았습니다.");
        setLoading(false);
        return;
      }
      const memberIdNum = Number(id);

      try {
        setLoading(true);
        const memberData = await memberService.getMemberById(memberIdNum);

        // Authorization check after fetching member data
        if (
          !user ||
          (user.role !== "EXECUTIVE" && user.memberId !== memberData.id)
        ) {
          setError("사용자 정보를 수정할 권한이 없습니다.");
          setLoading(false);
          return;
        }

        const [allTeamsPage, memberTeamsData, allCellsPage] = await Promise.all(
          [
            teamService.getAllTeams({}),
            memberService.getMemberTeams(memberIdNum),
            cellService.getAllCells({}),
          ]
        );

        setOriginalMemberName(memberData.name);
        const currentCellId = memberData.cell?.id;
        setOriginalCellId(currentCellId);
        setIsCellLeader(memberData.role === "CELL_LEADER");
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
        setError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user]);

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
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleCellSelect = (cellId: number | undefined) => {
    setFormData((prev) => ({ ...prev, cellId }));
  };

  const handleToggleChange = () => {
    setFormData((prev) => ({ ...prev, active: !prev.active }));
  };

  const handleTeamChange = (selectedIds: number[]) => {
    setSelectedTeamIds(selectedIds);
  };

  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};
    if (!formData.name) newErrors.name = "이름은 필수입니다.";
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email || ""))
      newErrors.email = "올바른 이메일 형식이 아닙니다.";
    if (!formData.phone) newErrors.phone = "연락처는 필수입니다.";
    if (!formData.birthDate) newErrors.birthDate = "생년월일은 필수입니다.";
    if (isCellLeader && formData.cellId === undefined) {
      newErrors.cellId = "셀장은 셀에서 제외될 수 없습니다.";
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

    setLoading(true);
    try {
      const memberIdNum = Number(id);
      const updatePromises: Promise<any>[] = [];

      // Separate cellId from other form data
      const { cellId, ...otherData } = formData;

      // 1. Update other member info (excluding cellId), only if there are changes
      if (Object.keys(otherData).length > 0) {
        // Check if there's anything to update besides cellId
        updatePromises.push(memberService.updateMember(memberIdNum, otherData));
      }

      // 2. Handle cell update only if it has changed
      if (cellId !== originalCellId) {
        if (cellId === undefined) {
          // Cell is being unassigned
          updatePromises.push(
            memberService.unassignMemberFromCell(memberIdNum)
          );
        } else {
          // Cell is being assigned or changed to a different cell
          updatePromises.push(
            memberService.updateMember(memberIdNum, { cellId })
          );
        }
      }

      // 3. Update teams
      const currentTeamIds = new Set(memberTeams.map((team) => team.id));
      const newTeamIds = new Set(selectedTeamIds);
      const teamsToRemove = Array.from(currentTeamIds).filter(
        (teamId) => !newTeamIds.has(teamId)
      );
      const teamsToAdd = Array.from(newTeamIds).filter(
        (teamId) => !currentTeamIds.has(teamId)
      );

      teamsToRemove.forEach((teamId) =>
        updatePromises.push(
          memberService.removeMemberFromTeam(memberIdNum, teamId)
        )
      );
      teamsToAdd.forEach((teamId) =>
        updatePromises.push(memberService.addMemberToTeam(memberIdNum, teamId))
      );

      await Promise.all(updatePromises);

      navigate("/admin/users");
    } catch (err: any) {
      setFormErrors({
        submit: err.response?.data?.message || "멤버 수정에 실패했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="mt-4 text-gray-600">로딩 중...</p>;
  if (error) return <p className="mt-4 text-red-600">{error}</p>;

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

        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
            개인 정보
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div>
              <label className="block text-sm font-medium text-gray-700">
                이메일 <span className="text-red-500">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                value={formData.email || ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              {formErrors.email && (
                <p className="mt-1 text-sm text-red-600">{formErrors.email}</p>
              )}
            </div>
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
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
              {formErrors.phone && (
                <p className="mt-1 text-sm text-red-600">{formErrors.phone}</p>
              )}
            </div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700">
                성별
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

        <fieldset className="space-y-4 p-4 border rounded-md">
          <legend className="text-lg font-medium text-gray-900 px-2">
            교회 정보
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                셀
              </label>
              <SimpleSearchableSelect
                options={cellOptions}
                value={formData.cellId}
                onChange={(value) =>
                  handleCellSelect(
                    typeof value === "number" ? value : undefined
                  )
                }
                placeholder="셀을 선택하세요..."
                isDisabled={isCellLeader}
              />
              {isCellLeader && (
                <p className="mt-1 text-sm text-gray-500">
                  셀장은 셀에서 제외될 수 없습니다.
                </p>
              )}
              {formErrors.cellId && (
                <p className="mt-1 text-sm text-red-600">{formErrors.cellId}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                역할
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                disabled={isCellLeader}
              >
                <option value="MEMBER">셀원</option>
                <option value="CELL_LEADER">셀장</option>
                <option value="EXECUTIVE">임원</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                등록 연도
              </label>
              <input
                name="joinYear"
                type="number"
                value={formData.joinYear || ""}
                onChange={handleFormChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="block text-sm font-medium text-gray-700">
                활성 상태
              </span>
              <button
                type="button"
                onClick={handleToggleChange}
                className={`${
                  formData.active ? "bg-indigo-600" : "bg-gray-200"
                } relative inline-flex items-center h-6 rounded-full w-11 transition-colors`}
              >
                <span
                  className={`${
                    formData.active ? "translate-x-6" : "translate-x-1"
                  } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
                />
              </button>
            </div>
          </div>
          <div>
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
          </div>
        </fieldset>

        {user?.role === "EXECUTIVE" && (
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

        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md mr-2"
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

export default EditMemberPage;
