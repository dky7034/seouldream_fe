// src/pages/EditCellPage.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import type { UpdateCellRequest, CellFormErrors, MemberDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import {
  formatDisplayName,
  formatNameWithBirthdate,
} from "../utils/memberUtils";

const EditCellPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false); // 🔹 삭제 로딩 상태
  const [error, setError] = useState<string | null>(null);

  // 폼 데이터
  const [formData, setFormData] = useState<UpdateCellRequest>({});

  // 데이터 목록 상태
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [initialCellMembers, setInitialCellMembers] = useState<MemberDto[]>([]);

  // 선택된 멤버 ID 목록
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const [formErrors, setFormErrors] = useState<CellFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [createdYear, setCreatedYear] = useState<number | null>(null);

  // UI 상태
  const [membersSearchTerm, setMembersSearchTerm] = useState("");
  const [isMembersDropdownOpen, setIsMembersDropdownOpen] = useState(false);

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!id || !user) return;
      const cellIdNum = Number(id);

      if (
        user.role !== "EXECUTIVE" &&
        (user.role !== "CELL_LEADER" || user.cellId !== cellIdNum)
      ) {
        setError("이 셀을 수정할 권한이 없습니다.");
        setIsFetching(false);
        return;
      }

      try {
        setIsFetching(true);
        const [cellData, allMembersPage] = await Promise.all([
          cellService.getCellById(cellIdNum),
          memberService.getAllMembers({ size: 1000 }),
        ]);

        setOriginalName(cellData.name);

        const createdAt = (cellData as any).createdAt;
        if (createdAt) {
          const year = new Date(createdAt).getFullYear();
          if (!Number.isNaN(year)) setCreatedYear(year);
        }

        setFormData({
          name: cellData.name,
          leaderId: cellData.leader?.id,
          viceLeaderId: cellData.viceLeader?.id,
          description: cellData.description,
          active: cellData.active,
        });

        const allMembers = allMembersPage.content;
        setMembers(allMembers);

        const currentMembers = ((cellData as any).members as MemberDto[]) || [];
        setInitialCellMembers(currentMembers);
        setSelectedMemberIds(currentMembers.map((m) => m.id));
      } catch (err) {
        console.error(err);
        setError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchInitialData();
  }, [id, user]);

  // ... (useMemo 로직들은 기존과 동일하여 생략하지 않고 전체 코드 유지) ...
  const leaderOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: formatDisplayName(m, members),
      })),
    [members],
  );

  const viceLeaderOptions = useMemo(() => {
    const currentSelectedMembers = members.filter((m) =>
      selectedMemberIds.includes(m.id),
    );
    let options = [...currentSelectedMembers];
    if (
      formData.viceLeaderId &&
      !options.some((m) => m.id === formData.viceLeaderId)
    ) {
      const missingVice = members.find((m) => m.id === formData.viceLeaderId);
      if (missingVice) options.push(missingVice);
    }
    return options
      .filter((m) => m.id !== formData.leaderId)
      .map((m) => ({ value: m.id, label: formatDisplayName(m, members) }));
  }, [members, selectedMemberIds, formData.viceLeaderId, formData.leaderId]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleMemberSelect = (
    field: "leaderId" | "viceLeaderId",
    memberId: number | undefined,
  ) => {
    setFormData((prev) => {
      const newState: UpdateCellRequest = { ...prev, [field]: memberId };
      if (field === "leaderId" && memberId && user?.role === "EXECUTIVE") {
        const selectedLeader = members.find((m) => m.id === memberId);
        if (selectedLeader) newState.name = `${selectedLeader.name}셀`;
      }
      return newState;
    });
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "leaderId" && memberId) {
      setSelectedMemberIds((prev) =>
        prev.includes(memberId) ? prev : [...prev, memberId],
      );
    }
  };

  const handleToggleChange = () => {
    setFormData((prev) => ({ ...prev, active: !prev.active }));
  };

  const candidateMembers = useMemo(() => {
    const selectedSet = new Set(selectedMemberIds);
    return members.filter((member) => {
      if (selectedSet.has(member.id)) return true;
      if (!member.cell) return true;
      if (initialCellMembers.some((cm) => cm.id === member.id)) return true;
      return false;
    });
  }, [members, selectedMemberIds, initialCellMembers]);

  const filteredMembers = useMemo(
    () =>
      candidateMembers.filter((member) =>
        formatNameWithBirthdate(member)
          .toLowerCase()
          .includes(membersSearchTerm.toLowerCase()),
      ),
    [candidateMembers, membersSearchTerm],
  );

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.includes(m.id)),
    [members, selectedMemberIds],
  );

  const handleToggleCellMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      if (formData.leaderId && memberId === formData.leaderId) return prev;
      return prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId];
    });
  };

  const handleRemoveCellMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      if (formData.leaderId && memberId === formData.leaderId) return prev;
      return prev.filter((id) => id !== memberId);
    });
  };

  const validateForm = (): CellFormErrors => {
    const newErrors: CellFormErrors = {};
    if (!formData.name?.trim()) newErrors.name = "셀 이름은 필수입니다.";
    return newErrors;
  };

  // 저장 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSubmitError(null);
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: UpdateCellRequest = {
        name: formData.name,
        leaderId: formData.leaderId,
        viceLeaderId: formData.viceLeaderId,
        description: formData.description,
        active: formData.active,
        memberIds: selectedMemberIds,
      };

      await cellService.updateCell(Number(id), payload);
      navigate(
        user?.role === "EXECUTIVE" ? "/admin/cells" : `/admin/cells/${id}`,
      );
    } catch (err: any) {
      console.error("셀 수정 실패:", err);
      setSubmitError(err.response?.data?.message || "셀 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isFetching && !error) return <div className="p-6">로딩 중...</div>;
  if (error)
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-4 py-2 bg-gray-200 rounded"
        >
          뒤로가기
        </button>
      </div>
    );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          셀 수정: {originalName}
        </h1>
        {createdYear && (
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            생성 연도:{" "}
            <span className="font-medium text-gray-900">{createdYear}년</span>
          </p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6"
      >
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {/* ... (셀장, 이름, 예비셀장, 구성원 선택 UI는 기존과 동일) ... */}

        {/* 셀장 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀장 <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <SimpleSearchableSelect
              options={leaderOptions}
              value={formData.leaderId}
              onChange={(v) =>
                handleMemberSelect(
                  "leaderId",
                  typeof v === "number" ? v : undefined,
                )
              }
              placeholder="셀장을 선택하세요..."
              disabled={user?.role !== "EXECUTIVE"}
            />
          </div>
          {formErrors.leaderId && (
            <p className="text-xs text-red-600 mt-1">{formErrors.leaderId}</p>
          )}
        </div>

        {/* 셀 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀 이름 <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            type="text"
            required
            value={formData.name || ""}
            onChange={handleFormChange}
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={user?.role !== "EXECUTIVE"}
          />
        </div>

        {/* 예비셀장 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            예비셀장
          </label>
          <div className="mt-1">
            <SimpleSearchableSelect
              options={viceLeaderOptions}
              value={formData.viceLeaderId}
              onChange={(v) =>
                handleMemberSelect(
                  "viceLeaderId",
                  typeof v === "number" ? v : undefined,
                )
              }
              placeholder="예비셀장을 선택하세요..."
            />
          </div>
        </div>

        {/* 구성원 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀 구성원
          </label>
          <div className="mt-1 relative">
            <button
              type="button"
              onClick={() => setIsMembersDropdownOpen(!isMembersDropdownOpen)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm bg-white"
            >
              <span className="text-gray-800 truncate">
                {selectedMembers.length > 0
                  ? `${selectedMembers.length}명 선택됨`
                  : "구성원 선택..."}
              </span>
              <span className="text-gray-400 text-xs">
                {isMembersDropdownOpen ? "▲" : "▼"}
              </span>
            </button>
            {isMembersDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="이름 검색..."
                    value={membersSearchTerm}
                    onChange={(e) => setMembersSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="p-3 text-xs text-gray-500">
                      검색 결과가 없습니다.
                    </p>
                  ) : (
                    <ul>
                      {filteredMembers.map((member) => {
                        const isLeader = formData.leaderId === member.id;
                        const checked = selectedMemberIds.includes(member.id);
                        return (
                          <li
                            key={member.id}
                            className={`hover:bg-indigo-50 ${checked ? "bg-indigo-50" : ""}`}
                          >
                            <label className="flex items-center w-full px-3 py-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isLeader}
                                onChange={() =>
                                  handleToggleCellMember(member.id)
                                }
                                className="mr-2 h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                              />
                              <span className="text-sm text-gray-700">
                                {formatNameWithBirthdate(member)}
                              </span>
                              {isLeader && (
                                <span className="ml-1 text-[10px] text-indigo-600 font-bold">
                                  (셀장)
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                <div className="flex justify-end px-3 py-2 border-t bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setIsMembersDropdownOpen(false)}
                    className="text-xs text-indigo-600 font-medium"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* 선택된 멤버 태그 */}
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedMembers.map((m) => {
              const isLeader = formData.leaderId === m.id;
              return (
                <span
                  key={m.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
                >
                  {formatNameWithBirthdate(m)}
                  {isLeader ? (
                    <span className="ml-1 text-[10px] font-bold">(셀장)</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRemoveCellMember(m.id)}
                      className="ml-1 text-indigo-400 hover:text-indigo-700"
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* 활성 상태 */}
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-gray-700">
            활성 상태
          </span>
          <button
            type="button"
            onClick={handleToggleChange}
            disabled={user?.role !== "EXECUTIVE"}
            className={`${formData.active ? "bg-indigo-600" : "bg-gray-200"} relative inline-flex h-6 w-11 items-center rounded-full transition-colors`}
          >
            <span
              className={`${formData.active ? "translate-x-6" : "translate-x-1"} inline-block h-4 w-4 transform bg-white rounded-full transition-transform`}
            />
          </button>
        </div>

        {/* 하단 버튼 영역 (삭제 버튼 추가됨) */}
        <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* 우측: 취소/저장 버튼 */}
          <div className="flex w-full sm:w-auto gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
              disabled={isSubmitting || isDeleting}
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              disabled={isSubmitting || isDeleting}
            >
              {isSubmitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditCellPage;
