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
  const [error, setError] = useState<string | null>(null);

  // 폼 데이터
  const [formData, setFormData] = useState<UpdateCellRequest>({});

  // 데이터 목록 상태
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [initialCellMembers, setInitialCellMembers] = useState<MemberDto[]>([]); // 수정 전 원래 멤버

  // 🔹 핵심: 최종 선택된 멤버 ID 목록 (Payload로 전송될 데이터)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  const [formErrors, setFormErrors] = useState<CellFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [createdYear, setCreatedYear] = useState<number | null>(null);

  // UI 상태 (드롭다운, 검색)
  const [membersSearchTerm, setMembersSearchTerm] = useState("");
  const [isMembersDropdownOpen, setIsMembersDropdownOpen] = useState(false);

  // 초기 데이터 로딩
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!id || !user) return;

      const cellIdNum = Number(id);

      // 권한 체크
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
        // 셀 정보와 전체 멤버 목록을 동시에 가져옴
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

        // 현재 셀에 소속된 멤버들을 상태에 설정
        const currentMembers = ((cellData as any).members as MemberDto[]) || [];
        setInitialCellMembers(currentMembers);

        // 🔹 중요: 기존 멤버들의 ID로 선택 상태 초기화
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

  // 셀장 선택 옵션
  const leaderOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: formatDisplayName(m, members),
      })),
    [members],
  );

  // 예비셀장 선택 옵션
  const viceLeaderOptions = useMemo(() => {
    // 현재 선택된 멤버 리스트 + (혹시 빠져있을지 모를) 현재 설정된 예비셀장
    const currentSelectedMembers = members.filter((m) =>
      selectedMemberIds.includes(m.id),
    );

    const options = [...currentSelectedMembers];
    if (
      formData.viceLeaderId &&
      !options.some((m) => m.id === formData.viceLeaderId)
    ) {
      const missingVice = members.find((m) => m.id === formData.viceLeaderId);
      if (missingVice) options.push(missingVice);
    }

    return options
      .filter((m) => m.id !== formData.leaderId) // 셀장은 예비셀장이 될 수 없음
      .map((m) => ({
        value: m.id,
        label: formatDisplayName(m, members),
      }));
  }, [members, selectedMemberIds, formData.viceLeaderId, formData.leaderId]);

  // 기본 입력 핸들러
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  // 셀장/부셀장 선택 핸들러
  const handleMemberSelect = (
    field: "leaderId" | "viceLeaderId",
    memberId: number | undefined,
  ) => {
    setFormData((prev) => {
      const newState: UpdateCellRequest = { ...prev, [field]: memberId };
      // 임원진인 경우 셀장 변경 시 이름 자동 변경 편의 기능
      if (field === "leaderId" && memberId && user?.role === "EXECUTIVE") {
        const selectedLeader = members.find((m) => m.id === memberId);
        if (selectedLeader) {
          newState.name = `${selectedLeader.name}셀`;
        }
      }
      return newState;
    });
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));

    // 🔹 셀장이 선택되면 자동으로 구성원 목록에 추가 (강제)
    if (field === "leaderId" && memberId) {
      setSelectedMemberIds((prev) =>
        prev.includes(memberId) ? prev : [...prev, memberId],
      );
    }
  };

  const handleToggleChange = () => {
    setFormData((prev) => ({ ...prev, active: !prev.active }));
  };

  // 멤버 추가 드롭다운에 표시할 후보군 필터링
  const candidateMembers = useMemo(() => {
    const selectedSet = new Set(selectedMemberIds);

    return members.filter((member) => {
      // 1. 이미 선택된 멤버는 무조건 표시 (체크 해제 가능하도록)
      if (selectedSet.has(member.id)) return true;

      // 2. 소속 없는 멤버 표시
      if (!member.cell) return true;

      // 3. (중요) 원래 이 셀 소속이었던 멤버 표시 (실수로 뺐다가 다시 넣을 수 있도록)
      const wasInThisCell = initialCellMembers.some(
        (cm) => cm.id === member.id,
      );
      if (wasInThisCell) return true;

      return false;
    });
  }, [members, selectedMemberIds, initialCellMembers]);

  // 검색어 필터링
  const filteredMembers = useMemo(
    () =>
      candidateMembers.filter((member) =>
        formatNameWithBirthdate(member)
          .toLowerCase()
          .includes(membersSearchTerm.toLowerCase()),
      ),
    [candidateMembers, membersSearchTerm],
  );

  // 현재 선택된 멤버들의 전체 정보 (배지 표시용)
  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.includes(m.id)),
    [members, selectedMemberIds],
  );

  // 체크박스 토글 핸들러
  const handleToggleCellMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      // 셀장은 제거 불가
      if (formData.leaderId && memberId === formData.leaderId) return prev;

      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  // 배지 X 버튼 삭제 핸들러
  const handleRemoveCellMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      if (formData.leaderId && memberId === formData.leaderId) return prev;
      return prev.filter((id) => id !== memberId);
    });
  };

  const validateForm = (): CellFormErrors => {
    const newErrors: CellFormErrors = {};
    if (!formData.name?.trim()) {
      newErrors.name = "셀 이름은 필수입니다.";
    }
    return newErrors;
  };

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
      // 🔹 백엔드 스펙에 맞춘 Payload 구성
      // UpdateCellRequest 타입에 memberIds가 정식으로 추가되었으므로 바로 사용 가능
      const payload: UpdateCellRequest = {
        name: formData.name,
        leaderId: formData.leaderId,
        viceLeaderId: formData.viceLeaderId,
        description: formData.description,
        active: formData.active,
        memberIds: selectedMemberIds, // 여기에 포함되지 않은 ID는 백엔드에서 셀 제외 처리됨
      };

      console.log("Saving Cell Payload:", payload); // 디버깅용

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

  // UI 렌더링
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

      {/* 폼 */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6"
      >
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {/* 1. 셀장 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀장 <span className="text-red-500">*</span>
          </label>
          <div className="mt-1">
            <SimpleSearchableSelect
              options={leaderOptions}
              value={formData.leaderId}
              onChange={(value) =>
                handleMemberSelect(
                  "leaderId",
                  typeof value === "number" ? value : undefined,
                )
              }
              placeholder="셀장을 선택하세요..."
              disabled={user?.role !== "EXECUTIVE"}
            />
          </div>
          {formErrors.leaderId && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.leaderId}
            </p>
          )}
        </div>

        {/* 2. 셀 이름 */}
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
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={user?.role !== "EXECUTIVE"}
          />
          {formErrors.name && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.name}
            </p>
          )}
        </div>

        {/* 3. 예비셀장 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            예비셀장
          </label>
          <div className="mt-1">
            <SimpleSearchableSelect
              options={viceLeaderOptions}
              value={formData.viceLeaderId}
              onChange={(value) =>
                handleMemberSelect(
                  "viceLeaderId",
                  typeof value === "number" ? value : undefined,
                )
              }
              placeholder="예비셀장을 선택하세요..."
            />
          </div>
        </div>

        {/* 4. 셀 구성원 편집 (핵심) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀 구성원
          </label>
          <p className="mt-1 mb-2 text-xs text-gray-500">
            체크된 멤버만 셀에 남습니다. (체크 해제 시 셀에서 제외)
          </p>

          <div className="mt-1 relative">
            {/* 드롭다운 토글 버튼 */}
            <button
              type="button"
              onClick={() => setIsMembersDropdownOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <span className="text-gray-800 truncate">
                {selectedMembers.length > 0
                  ? `${selectedMembers.length}명 선택됨`
                  : "구성원 선택..."}
              </span>
              <span className="ml-2 text-gray-400 text-xs">
                {isMembersDropdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {/* 드롭다운 내용 */}
            {isMembersDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="이름으로 검색..."
                    value={membersSearchTerm}
                    onChange={(e) => setMembersSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="p-3 text-xs sm:text-sm text-gray-500">
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
                            className={`flex items-center text-xs sm:text-sm hover:bg-indigo-50 ${
                              checked ? "bg-indigo-50" : ""
                            }`}
                          >
                            <label className="flex items-center w-full px-3 py-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isLeader} // 셀장은 해제 불가
                                onChange={() =>
                                  handleToggleCellMember(member.id)
                                }
                                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                              />
                              {formatNameWithBirthdate(member)}
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
                <div className="flex items-center justify-end px-3 py-2 border-t border-gray-100 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setIsMembersDropdownOpen(false)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 선택된 구성원 태그 표시 */}
          {selectedMembers.length > 0 && (
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
                        className="ml-1 text-indigo-400 hover:text-indigo-700 focus:outline-none"
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. 활성 상태 */}
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium text-gray-700">
            활성 상태
          </span>
          <button
            type="button"
            onClick={handleToggleChange}
            disabled={user?.role !== "EXECUTIVE"}
            className={`${
              formData.active ? "bg-indigo-600" : "bg-gray-200"
            } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50`}
          >
            <span
              className={`${
                formData.active ? "translate-x-6" : "translate-x-1"
              } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
            />
          </button>
        </div>

        {/* 6. 저장 버튼 */}
        <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium disabled:opacity-60"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCellPage;
