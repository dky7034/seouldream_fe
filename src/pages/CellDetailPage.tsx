import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import { exportService } from "../services/exportService";
import type {
  CellDto,
  CellAttendanceSummaryDto,
  TotalSummaryDto,
  MemberDto,
} from "../types";
import { useAuth } from "../hooks/useAuth";
import ConfirmModal from "../components/ConfirmModal";
import { useDebounce } from "../hooks/useDebounce";
import { formatNameWithBirthdate } from "../utils/memberUtils";

// AddMemberToCellModal Component
const AddMemberToCellModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberId: number) => Promise<void>;
}> = ({ isOpen, onClose, onSave }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemberDto[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  useEffect(() => {
    if (isOpen) {
      setIsSearching(true);
      memberService
        .getAllMembers({
          name: debouncedSearchTerm,
          unassigned: true,
          size: 20,
        })
        .then((page) => {
          setSearchResults(page.content);
        })
        .catch((err) => console.error("Failed to search members:", err))
        .finally(() => setIsSearching(false));
    }
  }, [isOpen, debouncedSearchTerm]);

  useEffect(() => {
    // Reset state when modal opens/closes
    if (!isOpen) {
      setSearchTerm("");
      setSearchResults([]);
      setSelectedMemberId(null);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!selectedMemberId) return;
    setIsSaving(true);
    await onSave(selectedMemberId);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-xl font-bold mb-4">셀에 멤버 추가</h2>
        <div className="mb-4">
          <input
            type="text"
            placeholder="추가할 미소속 멤버 이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
        <div className="mb-6 max-h-60 overflow-y-auto border rounded-md">
          {isSearching && <p className="p-4 text-gray-500">검색 중...</p>}
          {!isSearching && searchResults.length === 0 && (
            <p className="p-4 text-gray-500">
              {debouncedSearchTerm
                ? "검색 결과가 없습니다."
                : "셀에 소속되지 않은 멤버가 없습니다."}
            </p>
          )}
          <ul>
            {searchResults.map((member) => (
              <li
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`p-3 cursor-pointer hover:bg-indigo-50 ${
                  selectedMemberId === member.id ? "bg-indigo-100" : ""
                }`}
              >
                {formatNameWithBirthdate(member)} ({member.username})
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-gray-700 bg-gray-200 hover:bg-gray-300"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            disabled={!selectedMemberId || isSaving}
          >
            {isSaving ? "추가 중..." : "추가"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CellDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cell, setCell] = useState<CellDto | null>(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);

  const [totalSummary, setTotalSummary] = useState<TotalSummaryDto | null>(
    null
  );
  const [weeklySummary, setWeeklySummary] =
    useState<CellAttendanceSummaryDto | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);

  const [exportStartDate, setExportStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 3))
      .toISOString()
      .split("T")[0]
  );
  const [exportEndDate, setExportEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const fetchCellDetails = useCallback(async () => {
    try {
      setLoading(true);
      if (!id) {
        setError("셀 ID가 제공되지 않았습니다.");
        return;
      }
      const cellIdNum = Number(id);
      const fetchedCell = await cellService.getCellById(cellIdNum);

      if (
        user?.role !== "EXECUTIVE" &&
        !(user?.role === "CELL_LEADER" && user.cellId === cellIdNum)
      ) {
        setError("셀 정보를 조회할 권한이 없습니다.");
        setLoading(false);
        return;
      }
      setCell(fetchedCell);
    } catch (err: any) {
      setError("셀 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  const fetchTotalSummary = useCallback(async () => {
    if (!id) return;
    try {
      const currentYear = new Date().getFullYear();
      const summary = await cellService.getCellAttendanceSummary(Number(id), {
        startDate: `${currentYear}-01-01`,
        endDate: new Date().toISOString().split("T")[0],
      });
      setTotalSummary(summary.totalSummary);
    } catch (err) {
      console.error("Failed to fetch total attendance summary:", err);
    }
  }, [id]);

  const fetchWeeklySummary = useCallback(async () => {
    if (!id) return;
    const currentYear = new Date().getFullYear();
    const firstDayOfMonth = new Date(currentYear, selectedMonth - 1, 1)
      .toISOString()
      .split("T")[0];
    const lastDayOfMonth = new Date(currentYear, selectedMonth, 0)
      .toISOString()
      .split("T")[0];
    try {
      const summary = await cellService.getCellAttendanceSummary(Number(id), {
        startDate: firstDayOfMonth,
        endDate: lastDayOfMonth,
        groupBy: "WEEK",
      });
      setWeeklySummary(summary);
    } catch (err) {
      console.error("Failed to fetch weekly attendance summary:", err);
    }
  }, [id, selectedMonth]);

  useEffect(() => {
    if (user) {
      fetchCellDetails();
      fetchTotalSummary();
    }
  }, [user, fetchCellDetails, fetchTotalSummary]);

  useEffect(() => {
    if (cell) {
      fetchWeeklySummary();
    }
  }, [cell, fetchWeeklySummary]);

  const handleDelete = async () => {
    if (!cell) return;
    try {
      await cellService.deleteCell(cell.id);
      navigate("/admin/cells");
    } catch (err: any) {
      // Check if there's a specific message from the backend
      let errorMessage = "셀 삭제 중 오류가 발생했습니다.";
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = `셀 삭제 중 오류가 발생했습니다: ${err.message}`;
      }
      setError(errorMessage);
      setDeleteModalOpen(false);
    }
  };

  const handleAddMemberToCell = async (memberId: number) => {
    if (!id) return;
    try {
      await memberService.updateMember(memberId, { cellId: Number(id) });
      fetchCellDetails(); // Refresh cell details to show new member
    } catch (error) {
      console.error("Failed to add member to cell:", error);
      // You might want to show an error to the user
    }
  };

  const handleExportMembers = () =>
    cell && exportService.exportCellMembers(cell.id);
  const handleExportAttendances = () =>
    cell &&
    exportService.exportCellAttendances(
      cell.id,
      exportStartDate,
      exportEndDate
    );

  const sortedMembers = useMemo(() => {
    if (!cell?.members) return [];

    const leaderId = cell.leader?.id;
    const viceLeaderId = cell.viceLeader?.id;

    // Separate leader, vice-leader, and other members
    const leader = cell.members.find((member) => member.id === leaderId);
    const viceLeader = cell.members.find(
      (member) => member.id === viceLeaderId
    );
    const others = cell.members.filter(
      (member) => member.id !== leaderId && member.id !== viceLeaderId
    );

    // Sort others alphabetically by name
    others.sort((a, b) => a.name.localeCompare(b.name));

    // Assemble the sorted list
    const list = [];
    if (leader) list.push(leader);
    if (viceLeader && viceLeader.id !== leaderId) list.push(viceLeader); // Ensure vice-leader is not duplicated if also leader
    list.push(...others);

    return list;
  }, [cell]);

  const TotalAttendanceSummaryCard: React.FC<{ summary: TotalSummaryDto }> = ({
    summary,
  }) => (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          올해 총 출석 요약
        </h3>
      </div>
      <div className="border-t border-gray-200">
        <dl>
          {/* 출석률 */}
          <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">출석률</dt>
            <dd className="mt-1 text-lg font-bold text-indigo-600 sm:mt-0 sm:col-span-2">
              {summary.attendanceRate.toFixed(1)}%
            </dd>
          </div>

          {/* ✅ 여기에 있던 "출석/결석" 블록을 삭제했습니다 */}

          {/* 총 출석체크 횟수 */}
          <div className="bg-gray-50 px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">
              총 출석체크 횟수
            </dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {summary.totalRecordedDates}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );

  const WeeklyAttendanceSummaryTable: React.FC<{
    summaries: CellAttendanceSummaryDto["periodSummaries"] | undefined;
  }> = ({ summaries }) => {
    const formatWeek = (dateGroup: string) => {
      const [year, weekNum] = dateGroup.split("-W").map(Number);
      const firstDayOfYear = new Date(year, 0, 1);
      const days = (weekNum - 1) * 7;
      const date = new Date(
        firstDayOfYear.getTime() + days * 24 * 60 * 60 * 1000
      );

      const month = date.getMonth() + 1;

      const firstDayOfMonth = new Date(year, month - 1, 1);
      const dayOfWeek = firstDayOfMonth.getDay();
      const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

      let weekOfMonth = Math.ceil((date.getDate() - firstSunday + 1) / 7) + 1;
      if (date.getDate() < firstSunday) weekOfMonth = 1;

      return `${month}월 ${weekOfMonth}주차`;
    };

    const actions = (
      <div className="flex space-x-2">
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
          className="p-1 border rounded-md text-sm"
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}월
            </option>
          ))}
        </select>
      </div>
    );

    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mt-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            주차별 출석 요약
          </h3>
          {actions}
        </div>
        <div className="border-t border-gray-200 overflow-x-auto">
          {summaries && summaries.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주차
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    출석률
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...summaries]
                  .sort((a, b) => b.dateGroup.localeCompare(a.dateGroup))
                  .map((summary) => (
                    <tr key={summary.dateGroup}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatWeek(summary.dateGroup)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {summary.attendanceRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-4 text-sm text-gray-500">
              해당 월의 출석 요약 데이터가 없습니다.
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderExportCard = () => (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          데이터 추출 (xlsx)
        </h3>
      </div>
      <div className="border-t border-gray-200 p-6 space-y-4">
        <div>
          <button
            onClick={handleExportMembers}
            className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            셀 멤버 명단 다운로드
          </button>
        </div>
        <p className="text-sm font-medium text-gray-700 pt-2 border-t">
          출석 현황 다운로드 기간
        </p>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={exportStartDate}
            onChange={(e) => setExportStartDate(e.target.value)}
            className="p-2 border rounded-md w-full"
          />
          <span>~</span>
          <input
            type="date"
            value={exportEndDate}
            onChange={(e) => setExportEndDate(e.target.value)}
            className="p-2 border rounded-md w-full"
          />
        </div>
        <button
          onClick={handleExportAttendances}
          className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 mt-2"
        >
          출석 현황 다운로드
        </button>
      </div>
    </div>
  );

  if (loading) return <p className="mt-4 text-gray-600">로딩 중...</p>;
  if (error) return <p className="mt-4 text-red-600">{error}</p>;
  if (!cell)
    return <p className="mt-4 text-red-600">셀 정보를 찾을 수 없습니다.</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="셀 삭제"
        message={`'${cell.name}' 셀을 정말 삭제하시겠습니까? 셀에 속한 모든 셀원은 '*소속 셀 없음' 상태가 됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
      <AddMemberToCellModal
        isOpen={isAddMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        onSave={handleAddMemberToCell}
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        {cell.name} 상세 정보
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                기본 정보
              </h3>
              {user?.role === "EXECUTIVE" && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate(`/admin/cells/${id}/edit`)}
                    className="px-3 py-1 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => setDeleteModalOpen(true)}
                    className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200">
              <dl>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">셀 이름</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {cell.name}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">설명</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {cell.description || "없음"}
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    활동 여부
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {cell.active ? "활동 중" : "비활동"}
                  </dd>
                </div>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    편성 연도
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {new Date(cell.createdAt).getFullYear()}년
                  </dd>
                </div>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">
                    인원 구성
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    남 {cell.maleCount}명, 여 {cell.femaleCount}명
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          {totalSummary && (
            <TotalAttendanceSummaryCard summary={totalSummary} />
          )}
          <WeeklyAttendanceSummaryTable
            summaries={weeklySummary?.periodSummaries}
          />
        </div>
        <div className="space-y-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                셀원 목록 ({cell.members.length}명)
              </h3>
              {user?.role === "EXECUTIVE" && (
                <button
                  onClick={() => setAddMemberModalOpen(true)}
                  className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  + 셀원 추가
                </button>
              )}
            </div>
            <div className="border-t border-gray-200">
              {sortedMembers.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {sortedMembers.map((member) => (
                    <li
                      key={member.id}
                      className="px-4 py-4 sm:px-6 flex justify-between items-center"
                    >
                      <div className="flex items-center">
                        <button
                          onClick={() => navigate(`/admin/users/${member.id}`)}
                          className="text-sm text-indigo-600 hover:text-indigo-900"
                        >
                          {formatNameWithBirthdate(member)}
                        </button>
                        <span className="ml-2 text-sm text-gray-500">
                          (
                          {member.gender
                            ? member.gender.toUpperCase() === "MALE"
                              ? "남"
                              : "여"
                            : ""}
                          )
                        </span>
                      </div>
                      <div>
                        {member.id === cell.leader?.id && (
                          <span className="text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                            셀장
                          </span>
                        )}
                        {member.id === cell.viceLeader?.id && (
                          <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                            예비셀장
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-4 text-sm text-gray-500">
                  이 셀에 등록된 셀원이 없습니다.
                </p>
              )}
            </div>
          </div>
          {renderExportCard()}
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
        >
          뒤로 가기
        </button>
      </div>
    </div>
  );
};

export default CellDetailPage;
