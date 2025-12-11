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

  const [formData, setFormData] = useState<UpdateCellRequest>({});
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [cellMembers, setCellMembers] = useState<MemberDto[]>([]); // 🔹 해당 셀 멤버 전용
  const [formErrors, setFormErrors] = useState<CellFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [createdYear, setCreatedYear] = useState<number | null>(null);

  // 🔹 셀 구성원 멀티 선택용 상태 (AddCellPage 스타일)
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [membersSearchTerm, setMembersSearchTerm] = useState("");
  const [isMembersDropdownOpen, setIsMembersDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      // 1) id 유효성 체크
      if (!id) {
        setError("유효하지 않은 접근입니다. 셀 ID가 필요합니다.");
        setIsFetching(false);
        return;
      }

      const cellIdNum = Number(id);
      if (Number.isNaN(cellIdNum)) {
        setError("유효하지 않은 셀 ID 입니다.");
        setIsFetching(false);
        return;
      }

      // 2) user 로딩 안 됐으면 대기
      if (!user) {
        return;
      }

      // 3) 권한 체크: EXECUTIVE 또는 해당 셀의 셀장만 수정 가능
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

        // 셀 생성 연도
        const createdAt = (cellData as any).createdAt;
        if (createdAt) {
          const year = new Date(createdAt).getFullYear();
          if (!Number.isNaN(year)) {
            setCreatedYear(year);
          }
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

        // 🔹 해당 셀 멤버 설정 (백엔드에서 members를 내려준다고 가정)
        const cellMembersFromApi: MemberDto[] =
          ((cellData as any).members as MemberDto[]) || [];
        setCellMembers(cellMembersFromApi);

        // 🔹 기존 셀 구성원들로 selectedMemberIds 초기화
        setSelectedMemberIds(cellMembersFromApi.map((m) => m.id));
      } catch (err) {
        console.error(err);
        setError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setIsFetching(false);
      }
    };

    fetchInitialData();
  }, [id, user]);

  // 🔹 셀장 후보: 전체 멤버 기준 (현재 로직 유지)
  const leaderOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.id,
        label: formatDisplayName(m, members),
      })),
    [members]
  );

  // 🔹 예비셀장 후보: "현재 셀에 속한 멤버"만 사용
  //    + 예외적으로, 이미 저장된 viceLeader가 셀 멤버 목록에 없으면 추가해서 표시
  const viceLeaderOptions = useMemo(() => {
    let base = [...cellMembers];

    const currentViceLeaderId = formData.viceLeaderId;
    if (
      currentViceLeaderId &&
      !base.some((m) => m.id === currentViceLeaderId)
    ) {
      const currentViceLeader = members.find(
        (m) => m.id === currentViceLeaderId
      );
      if (currentViceLeader) {
        base.push(currentViceLeader);
      }
    }

    return base
      .filter((m) => m.id !== formData.leaderId) // 셀장과는 구분
      .map((m) => ({
        value: m.id,
        label: formatDisplayName(m, members),
      }));
  }, [cellMembers, formData.viceLeaderId, formData.leaderId, members]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setFormErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleMemberSelect = (
    field: "leaderId" | "viceLeaderId",
    memberId: number | undefined
  ) => {
    setFormData((prev) => {
      const newState: UpdateCellRequest = { ...prev, [field]: memberId };

      // 셀장 변경 시 이름 자동 변경 (EXECUTIVE 에서만)
      if (field === "leaderId" && memberId && user?.role === "EXECUTIVE") {
        const selectedLeader = members.find((m) => m.id === memberId);
        if (selectedLeader) {
          newState.name = `${selectedLeader.name}셀`;
        }
      }

      return newState;
    });
    setFormErrors((prev) => ({ ...prev, [field]: undefined }));

    // 🔹 셀장을 구성원 목록에 강제로 포함 (제거 불가)
    if (field === "leaderId" && memberId) {
      setSelectedMemberIds((prev) =>
        prev.includes(memberId) ? prev : [...prev, memberId]
      );
    }
  };

  const handleToggleChange = () => {
    setFormData((prev) => ({ ...prev, active: !prev.active }));
  };

  const validateForm = (): CellFormErrors => {
    const newErrors: CellFormErrors = {};
    if (!formData.name?.trim()) {
      newErrors.name = "셀 이름은 필수입니다.";
    }
    return newErrors;
  };

  // 🔹 셀 구성원 후보: 이 셀 소속 멤버 + 아직 어떤 셀에도 속하지 않은 멤버
  const candidateMembers = useMemo(
    () =>
      members.filter((member) => {
        const isInThisCell = cellMembers.some((cm) => cm.id === member.id);
        const hasNoCell = !member.cell;
        return isInThisCell || hasNoCell;
      }),
    [members, cellMembers]
  );

  // 검색 + 후보 필터
  const filteredMembers = useMemo(
    () =>
      candidateMembers.filter((member) =>
        formatNameWithBirthdate(member)
          .toLowerCase()
          .includes(membersSearchTerm.toLowerCase())
      ),
    [candidateMembers, membersSearchTerm]
  );

  // 선택된 셀 구성원 상세 정보 (표시용)
  const selectedMembers = useMemo(
    () => members.filter((m) => selectedMemberIds.includes(m.id)),
    [members, selectedMemberIds]
  );

  const handleToggleCellMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      // 🔹 셀장은 구성원 선택에서 제거 불가
      if (formData.leaderId && memberId === formData.leaderId) {
        return prev; // 그대로 유지
      }

      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleRemoveCellMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      if (formData.leaderId && memberId === formData.leaderId) {
        return prev; // 셀장은 제거 불가
      }
      return prev.filter((id) => id !== memberId);
    });
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
      const payload: UpdateCellRequest = {
        ...formData,
        // 🔹 셀 구성원 변경 반영 (백엔드에서 memberIds 처리한다고 가정)
        //    필요 시 타입 정의에 memberIds?: number[] 추가
        memberIds: selectedMemberIds,
      } as UpdateCellRequest;

      await cellService.updateCell(Number(id), payload);
      navigate(
        user?.role === "EXECUTIVE" ? "/admin/cells" : `/admin/cells/${id}`
      );
    } catch (err: any) {
      console.error("셀 수정 실패:", err);
      setSubmitError(err.response?.data?.message || "셀 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔹 로딩 상태
  if (isFetching && !error) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 text-sm sm:text-base text-gray-600">
          셀 정보를 불러오는 중입니다. 잠시만 기다려 주세요...
        </div>
      </div>
    );
  }

  // 🔹 에러 상태
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 sm:p-6">
          <p className="text-sm sm:text-base text-red-700">{error}</p>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-800 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              뒤로가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          셀 수정: {originalName}
        </h1>
        {createdYear && (
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            이 셀의 생성 연도:{" "}
            <span className="font-medium text-gray-900">{createdYear}년</span>
          </p>
        )}
      </div>

      {/* 폼 카드 */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 space-y-6"
      >
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError}
          </div>
        )}

        {/* 셀장 */}
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
                  typeof value === "number" ? value : undefined
                )
              }
              placeholder="셀장을 선택하세요..."
              isDisabled={user?.role !== "EXECUTIVE"}
            />
          </div>
          {formErrors.leaderId && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.leaderId}
            </p>
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
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            disabled={user?.role !== "EXECUTIVE"}
          />
          {formErrors.name && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.name}
            </p>
          )}
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
              onChange={(value) =>
                handleMemberSelect(
                  "viceLeaderId",
                  typeof value === "number" ? value : undefined
                )
              }
              placeholder="예비셀장을 선택하세요..."
            />
          </div>
          {formErrors.viceLeaderId && (
            <p className="mt-1 text-xs sm:text-sm text-red-600">
              {formErrors.viceLeaderId}
            </p>
          )}
        </div>

        {/* 🔹 셀 구성원 (AddCellPage와 동일 패턴: 셀렉트 버튼 + 드롭다운 멀티선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀 구성원
          </label>
          <p className="mt-1 mb-2 text-xs text-gray-500">
            이미 이 셀에 속한 멤버 + 아직 어떤 셀에도 속하지 않은 멤버만 선택할
            수 있습니다.
          </p>

          {/* 한 줄짜리 셀렉트 버튼 */}
          <div className="mt-1 relative">
            <button
              type="button"
              onClick={() => setIsMembersDropdownOpen((prev) => !prev)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            >
              {selectedMembers.length === 0 ? (
                <span className="text-gray-400">셀 구성원을 선택하세요...</span>
              ) : (
                <span className="text-gray-800 truncate">
                  {selectedMembers
                    .map((m) => formatNameWithBirthdate(m))
                    .join(", ")}
                </span>
              )}
              <span className="ml-2 text-gray-400 text-xs">
                {isMembersDropdownOpen ? "▲" : "▼"}
              </span>
            </button>

            {/* 드롭다운 패널 */}
            {isMembersDropdownOpen && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
                {/* 검색창 */}
                <div className="p-2 border-b border-gray-200">
                  <input
                    type="text"
                    placeholder="표시된 목록에서 이름으로 검색..."
                    value={membersSearchTerm}
                    onChange={(e) => setMembersSearchTerm(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* 리스트 영역 */}
                <div className="max-h-60 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="p-3 text-xs sm:text-sm text-gray-500">
                      {candidateMembers.length === 0
                        ? "선택 가능한 구성원이 없습니다."
                        : "검색 결과가 없습니다."}
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
                              checked ? "bg-indigo-100" : ""
                            }`}
                          >
                            <label
                              htmlFor={`cell-member-checkbox-${member.id}`}
                              className="flex items-center w-full px-3 py-2 cursor-pointer"
                            >
                              <input
                                id={`cell-member-checkbox-${member.id}`}
                                type="checkbox"
                                checked={checked}
                                disabled={isLeader} // 🔹 셀장은 체크박스 비활성화
                                onChange={() =>
                                  handleToggleCellMember(member.id)
                                }
                                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-60"
                              />
                              {formatNameWithBirthdate(member)}
                              {isLeader && (
                                <span className="ml-1 text-[10px] text-indigo-600 font-semibold">
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

                {/* 하단 요약 + 닫기 버튼 */}
                <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
                  <span className="text-xs text-gray-600">
                    선택된 구성원:{" "}
                    <span className="font-semibold">
                      {selectedMemberIds.length}명
                    </span>
                  </span>
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

          {/* 선택된 셀원 배지 표시 */}
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
                    {isLeader && (
                      <span className="ml-1 text-[10px] font-semibold text-indigo-700">
                        셀장
                      </span>
                    )}
                    {!isLeader && (
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
          )}

          <p className="mt-1 text-xs text-gray-600">
            현재 선택된 구성원:{" "}
            <span className="font-semibold">{selectedMemberIds.length}명</span>
          </p>
        </div>

        {/* 활성 상태 토글 */}
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

        {/* 버튼 영역 */}
        <div className="pt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
