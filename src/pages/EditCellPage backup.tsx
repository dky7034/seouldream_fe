import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import type { UpdateCellRequest, CellFormErrors, MemberDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";
import { formatDisplayName } from "../utils/memberUtils";

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

        // 🔹 전체 멤버 + 해당 셀 멤버 분리 저장
        setMembers(allMembersPage.content);
        setCellMembers((cellData as any).members || []);
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
      await cellService.updateCell(Number(id), formData);
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

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            설명
          </label>
          <textarea
            name="description"
            rows={3}
            value={formData.description || ""}
            onChange={handleFormChange}
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
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
