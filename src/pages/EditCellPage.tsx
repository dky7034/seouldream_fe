import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import type { UpdateCellRequest, CellFormErrors, MemberDto } from "../types";
import { useAuth } from "../hooks/useAuth";
import SimpleSearchableSelect from "../components/SimpleSearchableSelect";

const EditCellPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<UpdateCellRequest>({});
  const [members, setMembers] = useState<MemberDto[]>([]);
  const [formErrors, setFormErrors] = useState<CellFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState<string>("");
  const [createdYear, setCreatedYear] = useState<number | null>(null); // ✅ 추가

  useEffect(() => {
    const fetchInitialData = async () => {
      const cellIdNum = Number(id);
      if (!user || !id || isNaN(cellIdNum)) {
        setError("페이지에 접근할 권한이 없거나, 유효하지 않은 셀 ID 입니다.");
        setLoading(false);
        return;
      }

      // EXECUTIVE 또는 해당 셀의 셀장만 수정 가능
      if (
        user.role !== "EXECUTIVE" &&
        (user.role !== "CELL_LEADER" || user.cellId !== cellIdNum)
      ) {
        setError("이 셀을 수정할 권한이 없습니다.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [cellData, allMembersPage] = await Promise.all([
          cellService.getCellById(cellIdNum),
          memberService.getAllMembers({ size: 1000 }),
        ]);

        setOriginalName(cellData.name);

        // ✅ createdAt에서 생성 연도 추출
        const createdAt = (cellData as any).createdAt;
        if (createdAt) {
          const year = new Date(createdAt).getFullYear();
          if (!isNaN(year)) {
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
        setMembers(allMembersPage.content);
      } catch (err) {
        setError("데이터를 불러오는 데 실패했습니다.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [id, user]);

  const memberOptions = useMemo(
    () => members.map((m) => ({ value: m.id, label: m.name })),
    [members]
  );

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
      if (field === "leaderId" && memberId) {
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
    setSubmitError(null);
    if (!id) return;

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await cellService.updateCell(Number(id), formData);
      navigate(
        user?.role === "EXECUTIVE" ? "/admin/cells" : `/admin/cells/${id}`
      );
    } catch (err: any) {
      console.error("셀 수정 실패:", err);
      setSubmitError(err.response?.data?.message || "셀 수정에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="mt-4 text-gray-600">로딩 중...</p>;
  }

  if (error) {
    return <p className="mt-4 text-red-600">{error}</p>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        셀 수정: {originalName}
      </h1>

      {createdYear && (
        <p className="mb-4 text-sm text-gray-600">
          이 셀의 생성 연도:{" "}
          <span className="font-medium text-gray-900">{createdYear}년</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {submitError && (
          <div className="p-3 text-sm font-medium text-red-700 bg-red-100 border border-red-400 rounded-md">
            {submitError}
          </div>
        )}

        {/* 셀장 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            셀장 <span className="text-red-500">*</span>
          </label>
          <SimpleSearchableSelect
            options={memberOptions}
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
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={user?.role !== "EXECUTIVE"}
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
          )}
        </div>

        {/* 예비셀장 */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            예비셀장
          </label>
          <SimpleSearchableSelect
            options={memberOptions}
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
            className="block w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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

export default EditCellPage;
