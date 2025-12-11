// src/components/TeamForm.tsx
import React, { useEffect, useMemo, useState } from "react";
import { memberService } from "../services/memberService";
import type { CreateTeamRequest, UpdateTeamRequest, MemberDto } from "../types";
import { formatNameWithBirthdate } from "../utils/memberUtils";

type TeamFormValues = (CreateTeamRequest | UpdateTeamRequest) & {
  memberIds?: number[];
};

interface TeamFormProps {
  onSubmit: (values: TeamFormValues) => void | Promise<void>;
  loading: boolean;
  submitError: string | null;
  isEditing: boolean;
  initialData?: Partial<TeamFormValues>;
  /**
   * 수정 모드에서 "이미 이 팀에 포함된 멤버"가 있다면
   * 여기로 ID 배열을 넘겨줘서 선택 목록에 기본 세팅할 수 있음
   * (생성 모드에서는 보통 생략)
   */
  existingMemberIds?: number[];
}

const TeamForm: React.FC<TeamFormProps> = ({
  onSubmit,
  loading,
  submitError,
  isEditing,
  initialData,
  existingMemberIds = [],
}) => {
  // ───────── 기본 필드 상태 ─────────
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [active, setActive] = useState(
    initialData?.active ?? true // 생성 시 기본 활성
  );

  // 전체 멤버 캐시
  const [allMembers, setAllMembers] = useState<MemberDto[]>([]);

  // 선택된 팀 멤버 ID
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>(
    initialData?.memberIds ?? existingMemberIds ?? []
  );

  // 검색어 + 드롭다운 열림 상태 (AddCellPage 스타일)
  const [membersSearchTerm, setMembersSearchTerm] = useState("");
  const [isMembersDropdownOpen, setIsMembersDropdownOpen] = useState(false);

  const [localError, setLocalError] = useState<string | null>(null);

  // 현재 연도 (화면용)
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // ───────── 초기 데이터 로딩: 전체 멤버 ─────────
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const page = await memberService.getAllMembers({
          size: 1000,
          active: true, // 필요에 따라 조정 가능
        });
        const members = page.content;
        setAllMembers(members);
      } catch (error) {
        console.error("Failed to fetch members:", error);
      }
    };

    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────── 팀 구성원 후보 + 검색 필터 ─────────
  // 팀은 중복 소속 가능 → allMembers 전체를 대상으로
  const candidateMembers = useMemo(() => allMembers, [allMembers]);

  const filteredMembers = useMemo(
    () =>
      candidateMembers.filter((member) =>
        formatNameWithBirthdate(member)
          .toLowerCase()
          .includes(membersSearchTerm.toLowerCase())
      ),
    [candidateMembers, membersSearchTerm]
  );

  // 선택된 멤버 상세 (chip 표시용)
  const selectedMembers = useMemo(
    () => allMembers.filter((m) => selectedMemberIds.includes(m.id)),
    [allMembers, selectedMemberIds]
  );

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleRemoveMember = (memberId: number) => {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== memberId));
  };

  // ───────── 유효성 검사 ─────────
  const validate = (): boolean => {
    if (!name.trim()) {
      setLocalError("팀 이름은 필수입니다.");
      return false;
    }
    setLocalError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const payload: TeamFormValues = {
      name: name.trim(),
      description: description.trim() || undefined,
      active,
      memberIds: selectedMemberIds,
    };

    await onSubmit(payload);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
          {isEditing ? "팀 정보 수정" : "새 팀 추가"}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500">
          현재 기준 연도:{" "}
          <span className="font-medium text-gray-800">{currentYear}년</span>
        </p>
      </div>

      {/* 카드형 폼 */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5 sm:space-y-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6"
      >
        {/* 상단 에러 영역 */}
        {(submitError || localError) && (
          <div className="p-3 text-xs sm:text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md">
            {submitError || localError}
          </div>
        )}

        {/* 팀 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            팀 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 찬양팀, 미디어팀, 행사준비팀 등"
          />
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            설명
          </label>
          <textarea
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 resize-y min-h-[90px] max-h-[240px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="팀의 역할, 목적 등을 간단히 적어주세요."
          />
        </div>

        {/* 활성 여부 */}
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            활성 상태
          </label>
          <button
            type="button"
            onClick={() => setActive((prev) => !prev)}
            className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
              active
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-gray-50 text-gray-500 border-gray-200"
            }`}
          >
            {active ? "활동 중" : "비활성"}
          </button>
        </div>

        {/* 팀 구성원 (AddCellPage와 동일 패턴: 셀렉트 버튼 + 드롭다운 멀티 선택) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            팀 구성원
          </label>
          <p className="mt-1 mb-2 text-xs text-gray-500">
            팀은 중복 소속이 가능하므로, 다른 팀에 속해 있어도 자유롭게 선택할
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
                <span className="text-gray-400">팀 구성원을 선택하세요...</span>
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
                        ? "선택 가능한 팀원이 없습니다."
                        : "검색 결과가 없습니다."}
                    </p>
                  ) : (
                    <ul>
                      {filteredMembers.map((member) => (
                        <li
                          key={member.id}
                          className={`flex items-center text-xs sm:text-sm hover:bg-indigo-50 ${
                            selectedMemberIds.includes(member.id)
                              ? "bg-indigo-100"
                              : ""
                          }`}
                        >
                          <label
                            htmlFor={`team-member-checkbox-${member.id}`}
                            className="flex items-center w-full px-3 py-2 cursor-pointer"
                          >
                            <input
                              id={`team-member-checkbox-${member.id}`}
                              type="checkbox"
                              checked={selectedMemberIds.includes(member.id)}
                              onChange={() => handleToggleMember(member.id)}
                              className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            {formatNameWithBirthdate(member)}
                          </label>
                        </li>
                      ))}
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

          {/* 선택된 팀원 배지 표시 */}
          {selectedMembers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedMembers.map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
                >
                  {formatNameWithBirthdate(m)}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="ml-1 text-indigo-400 hover:text-indigo-700"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <p className="mt-1 text-xs text-gray-600">
            현재 선택된 구성원:{" "}
            <span className="font-semibold">{selectedMemberIds.length}명</span>
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className="pt-2 sm:pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            className="w-full sm:w-auto inline-flex justify-center items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
            onClick={() => window.history.back()}
          >
            취소
          </button>
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex justify-center items-center bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading
              ? isEditing
                ? "수정 중..."
                : "생성 중..."
              : isEditing
              ? "수정"
              : "생성"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TeamForm;
