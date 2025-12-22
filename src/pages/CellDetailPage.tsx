import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { cellService } from "../services/cellService";
import { memberService } from "../services/memberService";
import { attendanceService } from "../services/attendanceService";
import { semesterService } from "../services/semesterService";
import { exportService } from "../services/exportService";
import type {
  CellDto,
  MemberDto,
  AttendanceDto,
  SemesterDto,
  // MemberAttendanceSummaryDto, // 사용 안 하면 삭제 가능
} from "../types";
import { useAuth } from "../hooks/useAuth";
import ConfirmModal from "../components/ConfirmModal";
import { formatNameWithBirthdate } from "../utils/memberUtils";
import AttendanceMatrix from "../components/AttendanceMatrix";
// import MultiSelect from "../components/MultiSelect";
import { FaCalendarAlt, FaClock } from "react-icons/fa";

// ───────────────── AddMemberToCellModal ─────────────────
const AddMemberToCellModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (memberIds: number[]) => Promise<void>;
}> = ({ isOpen, onClose, onSave }) => {
  const [candidateMembers, setCandidateMembers] = useState<MemberDto[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    const fetchUnassignedMembers = async () => {
      if (!isOpen) {
        setCandidateMembers([]);
        setSelectedMemberIds([]);
        setSearchTerm("");
        setIsSaving(false);
        setIsLoadingMembers(false);
        return;
      }
      try {
        setIsLoadingMembers(true);
        const page = await memberService.getAllMembers({
          unassigned: true,
          size: 1000,
        });
        setCandidateMembers(page.content);
      } catch (error) {
        console.error("Failed to fetch unassigned members:", error);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    fetchUnassignedMembers();
  }, [isOpen]);

  const filteredMembers = useMemo(
    () =>
      candidateMembers.filter((member) =>
        formatNameWithBirthdate(member)
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      ),
    [candidateMembers, searchTerm]
  );

  const selectedMembers = useMemo(
    () => candidateMembers.filter((m) => selectedMemberIds.includes(m.id)),
    [candidateMembers, selectedMemberIds]
  );

  const handleToggleMember = (memberId: number) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleRemoveMember = (memberId: number) => {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== memberId));
  };

  const handleSave = async () => {
    if (selectedMemberIds.length === 0) return;
    setIsSaving(true);
    await onSave(selectedMemberIds);
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
        <h2 className="text-xl font-bold mb-2">셀에 멤버 추가</h2>
        <p className="text-xs sm:text-sm text-gray-600 mb-4">
          현재 어떤 셀에도 속하지 않은 멤버만 목록에 표시됩니다.
        </p>
        <div className="mb-4 space-y-2">
          <input
            type="text"
            placeholder="이름으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 rounded-md">
            {isLoadingMembers ? (
              <p className="p-3 text-xs sm:text-sm text-gray-500">
                미소속 멤버를 불러오는 중입니다...
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="p-3 text-xs sm:text-sm text-gray-500">
                {candidateMembers.length === 0
                  ? "현재 셀에 소속되지 않은 멤버가 없습니다."
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
                      htmlFor={`add-member-checkbox-${member.id}`}
                      className="flex items-center w-full px-3 py-2 cursor-pointer"
                    >
                      <input
                        id={`add-member-checkbox-${member.id}`}
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
          <p className="mt-1 text-xs text-gray-600">
            선택된 멤버:{" "}
            <span className="font-semibold">{selectedMemberIds.length}명</span>
          </p>
          {selectedMembers.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2">
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
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm text-gray-700 bg-gray-200 hover:bg-gray-300"
            disabled={isSaving}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
            disabled={selectedMemberIds.length === 0 || isSaving}
          >
            {isSaving ? "추가 중..." : `${selectedMemberIds.length}명 추가`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ───────────────── CellAttendanceMatrixCard ─────────────────// ───────────────── CellAttendanceMatrixCard ─────────────────
const CellAttendanceMatrixCard: React.FC<{
  cellId: number;
  sortedMembers: MemberDto[];
  // 컨트롤 State
  semesters: SemesterDto[];
  activeSemester: SemesterDto | null;
  onSemesterChange: (id: number) => void;
  unitType: "semester" | "month";
  onUnitTypeChange: (type: "semester" | "month") => void;
  selectedMonth: number | null;
  onMonthSelect: (month: number) => void;
  // Data
  matrixAttendances: AttendanceDto[];
  periodSummary: any; // CellAttendanceSummaryDto의 totalSummary 형태
  startDate: string;
  endDate: string;
}> = ({
  sortedMembers,
  semesters,
  activeSemester,
  onSemesterChange,
  unitType,
  onUnitTypeChange,
  selectedMonth,
  onMonthSelect,
  matrixAttendances,
  periodSummary,
  startDate,
  endDate,
}) => {
  // 학기 내 월 리스트
  const semesterMonths = useMemo(() => {
    if (!activeSemester) return [];
    const s = new Date(activeSemester.startDate);
    const e = new Date(activeSemester.endDate);
    const months: number[] = [];
    const current = new Date(s.getFullYear(), s.getMonth(), 1);
    const end = new Date(e.getFullYear(), e.getMonth(), 1);
    while (current <= end) {
      months.push(current.getMonth() + 1);
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  }, [activeSemester]);

  // 🔴 [수정됨] 가입일을 고려한 '미체크' 횟수 정밀 계산
  const uncheckedCount = useMemo(() => {
    if (!startDate || !endDate || sortedMembers.length === 0) return 0;

    const filterStart = new Date(startDate);
    const filterEnd = new Date(endDate);

    // 1. 전체 멤버들의 "유효한 출석체크 기회" 총합 계산
    let totalPossibleChecks = 0;

    sortedMembers.forEach((member) => {
      // 가입일 파싱 (createdAt 우선, 없으면 joinYear, 없으면 2000년)
      let joinDate: Date;
      if (member.createdAt) {
        joinDate = new Date(member.createdAt);
      } else if (member.joinYear) {
        joinDate = new Date(member.joinYear, 0, 1);
      } else {
        joinDate = new Date("2000-01-01");
      }
      joinDate.setHours(0, 0, 0, 0);

      // 이 멤버의 유효 시작일 (조회 시작일 vs 가입일 중 늦은 날짜)
      const effectiveStart = filterStart < joinDate ? joinDate : filterStart;

      // 아직 가입하지 않은 기간이면 패스
      if (effectiveStart > filterEnd) return;

      // 유효 기간 내 일요일 카운트
      const current = new Date(effectiveStart);
      current.setHours(0, 0, 0, 0);

      while (current <= filterEnd) {
        if (current.getDay() === 0) {
          totalPossibleChecks++;
        }
        current.setDate(current.getDate() + 1);
      }
    });

    // 2. 실제 기록된 수 (백엔드 통계 활용)
    const recordedChecks =
      (periodSummary?.totalPresent || 0) + (periodSummary?.totalAbsent || 0);

    // 3. 결과 도출
    return Math.max(0, totalPossibleChecks - recordedChecks);
  }, [startDate, endDate, sortedMembers, periodSummary]);

  const formatDate = (dateStr: string) => dateStr.replace(/-/g, ".");

  // Matrix에 넘길 멤버 포맷
  const matrixMembers = useMemo(
    () => sortedMembers.map((m) => ({ memberId: m.id, memberName: m.name })),
    [sortedMembers]
  );

  return (
    <div className="bg-white shadow-sm rounded-lg overflow-hidden">
      <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
        <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
          출석 요약 & 현황
        </h3>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* 컨트롤 패널 */}
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* 학기 선택 */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white px-3 py-1.5 rounded-md border border-gray-300 shadow-sm">
                <FaCalendarAlt className="text-indigo-500 mr-2 text-sm" />
                <select
                  value={activeSemester?.id || ""}
                  onChange={(e) => onSemesterChange(Number(e.target.value))}
                  className="bg-transparent text-gray-700 font-semibold text-sm focus:outline-none cursor-pointer min-w-[120px]"
                >
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 보기 모드 버튼 */}
            <div className="flex gap-1 bg-gray-200 p-1 rounded-lg self-start sm:self-auto">
              <button
                onClick={() => onUnitTypeChange("month")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  unitType === "month"
                    ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                    : "text-gray-500 hover:bg-gray-300"
                }`}
              >
                월별 보기
              </button>
              <button
                onClick={() => onUnitTypeChange("semester")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  unitType === "semester"
                    ? "bg-white text-indigo-700 shadow ring-1 ring-black/5"
                    : "text-gray-500 hover:bg-gray-300"
                }`}
              >
                학기 전체
              </button>
            </div>
          </div>

          {/* 월 선택 (월별 보기일 때만) */}
          {unitType === "month" && activeSemester && (
            <div className="animate-fadeIn">
              <span className="text-xs font-bold text-gray-500 block mb-2">
                {activeSemester.name} 상세 월 선택:
              </span>
              <div className="flex flex-wrap gap-2">
                {semesterMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => onMonthSelect(m)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                      selectedMonth === m
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-300"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {m}월
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 실제 기간 표시 */}
          <div className="flex items-center justify-end text-xs text-gray-500 border-t border-gray-200 pt-3 mt-1">
            <FaClock className="mr-1.5 text-gray-400" />
            <span className="font-medium">실제 조회 기간:</span>
            <span className="ml-2 font-mono bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
              {formatDate(startDate)} ~ {formatDate(endDate)}
            </span>
          </div>
        </div>

        {/* 4칸 통계 카드 */}
        {periodSummary ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center border-t border-b py-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-indigo-500">
                출석률
              </p>
              <p className="mt-1 text-2xl sm:text-3xl font-semibold text-indigo-600">
                {periodSummary.attendanceRate.toFixed(0)}
                <span className="text-lg">%</span>
              </p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-green-600">
                출석
              </p>
              <p className="mt-1 text-2xl sm:text-3xl font-semibold text-green-700">
                {periodSummary.totalPresent}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-red-600">
                결석
              </p>
              <p className="mt-1 text-2xl sm:text-3xl font-semibold text-red-700">
                {periodSummary.totalAbsent}
              </p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <p className="text-xs sm:text-sm font-medium text-gray-500">
                미체크
              </p>
              <p className="mt-1 text-2xl sm:text-3xl font-semibold text-gray-600">
                {uncheckedCount}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4 text-center">
            선택된 기간에 대한 데이터가 없습니다.
          </p>
        )}

        {/* 매트릭스 */}
        <div className="pt-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3 ml-1">
            {unitType === "semester"
              ? `[${activeSemester?.name}] 전체 현황`
              : `${selectedMonth}월 상세 현황 (학기 교집합)`}
          </h4>
          <AttendanceMatrix
            mode={unitType === "month" ? "month" : "semester"} // [수정] 모드 전달 명확화
            startDate={startDate}
            endDate={endDate}
            year={new Date(startDate).getFullYear()}
            month={new Date(startDate).getMonth() + 1}
            onMonthChange={() => {}}
            members={matrixMembers}
            attendances={matrixAttendances}
            loading={false}
            limitStartDate={activeSemester?.startDate} // [수정] 제한 기간 추가
            limitEndDate={activeSemester?.endDate} // [수정] 제한 기간 추가
          />
        </div>
      </div>
    </div>
  );
};

// ───────────────── 메인 페이지 ─────────────────
const CellDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [cell, setCell] = useState<CellDto | null>(null);

  // 모달 상태
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isAddMemberModalOpen, setAddMemberModalOpen] = useState(false);

  // [New] 기간 선택 및 매트릭스용 상태
  const [semesters, setSemesters] = useState<SemesterDto[]>([]);
  const [activeSemester, setActiveSemester] = useState<SemesterDto | null>(
    null
  );
  const [unitType, setUnitType] = useState<"semester" | "month">("semester");
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const [matrixAttendances, setMatrixAttendances] = useState<AttendanceDto[]>(
    []
  );
  const [periodSummary, setPeriodSummary] = useState<any>(null);

  // 엑셀용 기간 상태 (기존 유지)
  const [exportStartDate, setExportStartDate] = useState(
    new Date(new Date().setMonth(new Date().getMonth() - 3))
      .toISOString()
      .split("T")[0]
  );
  const [exportEndDate, setExportEndDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const cellIdNum = useMemo(() => (id ? Number(id) : null), [id]);

  // [Helper] 날짜의 '월'이 학기 범위 내인지 확인
  const isDateInSemesterMonthRange = (date: Date, semester: SemesterDto) => {
    const targetYm = date.getFullYear() * 12 + date.getMonth();
    const s = new Date(semester.startDate);
    const sYm = s.getFullYear() * 12 + s.getMonth();
    const e = new Date(semester.endDate);
    const eYm = e.getFullYear() * 12 + e.getMonth();
    return targetYm >= sYm && targetYm <= eYm;
  };

  // 1. 학기 로드 및 초기화
  useEffect(() => {
    const loadSemesters = async () => {
      try {
        const data = await semesterService.getAllSemesters(true);
        const sortedData = data.sort(
          (a, b) =>
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
        );
        setSemesters(sortedData);

        if (sortedData.length > 0) {
          const now = new Date();
          const currentSemester = sortedData.find((sem) =>
            isDateInSemesterMonthRange(now, sem)
          );

          if (currentSemester) {
            setActiveSemester(currentSemester);
          } else {
            setActiveSemester(sortedData[0]);
          }
          // 기본 정책: 학기 전체 보기
          setUnitType("semester");
          setSelectedMonth(null);
        }
      } catch (err) {
        console.error("학기 로딩 실패", err);
      }
    };
    loadSemesters();
  }, []);

  // 2. 기간 계산 (교집합 로직)
  const periodRange = useMemo(() => {
    if (!activeSemester) return { startDate: "", endDate: "" };

    const { startDate: semStart, endDate: semEnd } = activeSemester;

    if (unitType === "semester" || selectedMonth === null) {
      return { startDate: semStart, endDate: semEnd };
    }

    let targetYear = new Date(semStart).getFullYear();
    const startMonthIndex = new Date(semStart).getMonth() + 1;
    if (selectedMonth < startMonthIndex) {
      targetYear += 1;
    }

    const m = selectedMonth;
    const monthStartStr = `${targetYear}-${String(m).padStart(2, "0")}-01`;
    const lastDayObj = new Date(targetYear, m, 0);
    const monthEndStr = `${targetYear}-${String(m).padStart(2, "0")}-${String(
      lastDayObj.getDate()
    ).padStart(2, "0")}`;

    const finalStart = monthStartStr < semStart ? semStart : monthStartStr;
    const finalEnd = monthEndStr > semEnd ? semEnd : monthEndStr;

    return { startDate: finalStart, endDate: finalEnd };
  }, [activeSemester, unitType, selectedMonth]);

  // 3. 셀 상세 조회
  const fetchCellDetails = useCallback(async () => {
    try {
      setLoading(true);
      if (!cellIdNum) {
        setError("유효하지 않은 셀 ID입니다.");
        return;
      }
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
    } catch (err) {
      console.error(err);
      setError("셀 정보를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [cellIdNum, user]);

  // 4. 기간별 출석 데이터(매트릭스 & 통계) 조회
  const fetchPeriodData = useCallback(async () => {
    if (!cellIdNum || !periodRange.startDate) return;

    try {
      // (1) 통계
      const summary = await cellService.getCellAttendanceSummary(cellIdNum, {
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
      });
      setPeriodSummary(summary.totalSummary);

      // (2) 매트릭스용 리스트
      const listData = await attendanceService.getAttendances({
        cellId: cellIdNum,
        startDate: periodRange.startDate,
        endDate: periodRange.endDate,
        page: 0,
        size: 2000,
        sort: "date,asc",
      });
      setMatrixAttendances(listData.content || []);
    } catch (err) {
      console.error("Failed to fetch period attendance data:", err);
    }
  }, [cellIdNum, periodRange]);

  useEffect(() => {
    if (user) {
      fetchCellDetails();
    }
  }, [user, fetchCellDetails]);

  useEffect(() => {
    if (cell) {
      fetchPeriodData();
    }
  }, [cell, fetchPeriodData]);

  // 핸들러들
  const handleSemesterChange = (semesterId: number) => {
    const target = semesters.find((s) => s.id === semesterId);
    if (target) {
      setActiveSemester(target);
      setSelectedMonth(null);
      setUnitType("semester");
    }
  };

  const handleUnitTypeChange = (type: "semester" | "month") => {
    setUnitType(type);
    if (type === "semester") {
      setSelectedMonth(null);
      return;
    }
    if (activeSemester) {
      const now = new Date();
      if (isDateInSemesterMonthRange(now, activeSemester)) {
        setSelectedMonth(now.getMonth() + 1);
      } else {
        const s = new Date(activeSemester.startDate);
        setSelectedMonth(s.getMonth() + 1);
      }
    }
  };

  const handleDelete = async () => {
    if (!cell) return;
    try {
      await cellService.deleteCell(cell.id);
      navigate("/admin/cells");
    } catch (err: any) {
      let errorMessage = "셀 삭제 중 오류가 발생했습니다.";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      setError(errorMessage);
      setDeleteModalOpen(false);
    }
  };

  const handleAddMemberToCell = async (memberIds: number[]) => {
    if (!cellIdNum) return;
    try {
      await Promise.all(
        memberIds.map((memberId) =>
          memberService.updateMember(memberId, { cellId: cellIdNum })
        )
      );
      fetchCellDetails();
    } catch (error) {
      console.error("Failed to add members to cell:", error);
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

    const leader = cell.members.find((m) => m.id === leaderId);
    const viceLeader = cell.members.find((m) => m.id === viceLeaderId);
    const others = cell.members.filter(
      (m) => m.id !== leaderId && m.id !== viceLeaderId
    );

    others.sort((a, b) => a.name.localeCompare(b.name));

    const list: MemberDto[] = [];
    if (leader) list.push(leader);
    if (viceLeader && viceLeader.id !== leaderId) list.push(viceLeader);
    list.push(...others);

    return list;
  }, [cell]);

  // ───────────── 렌더링 ─────────────
  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  if (!cell) {
    return (
      <div className="bg-gray-50 min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-6 text-center">
          <p className="text-red-600 mb-4">셀 정보를 찾을 수 없습니다.</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
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

      <div className="container mx-auto max-w-6xl px-3 sm:px-4 py-6 sm:py-8">
        {/* 상단 헤더 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {cell.name} 상세 정보
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              셀 기본 정보, 출석 요약, 셀원 목록을 한눈에 확인할 수 있습니다.
            </p>
          </div>
          {user?.role === "EXECUTIVE" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/admin/cells/${id}/edit`)}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700"
              >
                수정
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 왼쪽 영역: 기본 정보 + 출석 매트릭스 카드 */}
          <div className="xl:col-span-2 space-y-6">
            {/* 기본 정보 카드 */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
                <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
                  기본 정보
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="px-4 py-4 sm:px-6 grid grid-cols-3 gap-4 bg-gray-50">
                  <dt className="col-span-1 text-xs sm:text-sm font-medium text-gray-500">
                    셀 이름
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900">
                    {cell.name}
                  </dd>
                </div>
                <div className="px-4 py-4 sm:px-6 grid grid-cols-3 gap-4 bg-white">
                  <dt className="col-span-1 text-xs sm:text-sm font-medium text-gray-500">
                    설명
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900">
                    {cell.description || "없음"}
                  </dd>
                </div>
                <div className="px-4 py-4 sm:px-6 grid grid-cols-3 gap-4 bg-gray-50">
                  <dt className="col-span-1 text-xs sm:text-sm font-medium text-gray-500">
                    활동 여부
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900">
                    {cell.active ? "활동 중" : "비활동"}
                  </dd>
                </div>
                <div className="px-4 py-4 sm:px-6 grid grid-cols-3 gap-4 bg-white">
                  <dt className="col-span-1 text-xs sm:text-sm font-medium text-gray-500">
                    편성 연도
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900">
                    {new Date(cell.createdAt).getFullYear()}년
                  </dd>
                </div>
                <div className="px-4 py-4 sm:px-6 grid grid-cols-3 gap-4 bg-gray-50">
                  <dt className="col-span-1 text-xs sm:text-sm font-medium text-gray-500">
                    인원 구성
                  </dt>
                  <dd className="col-span-2 text-sm text-gray-900">
                    남 {cell.maleCount}명, 여 {cell.femaleCount}명
                  </dd>
                </div>
              </div>
            </div>

            {/* [New] 출석 매트릭스 카드 (기존 Total/Weekly 요약 대체) */}
            <CellAttendanceMatrixCard
              cellId={cell.id}
              sortedMembers={sortedMembers}
              semesters={semesters}
              activeSemester={activeSemester}
              onSemesterChange={handleSemesterChange}
              unitType={unitType}
              onUnitTypeChange={handleUnitTypeChange}
              selectedMonth={selectedMonth}
              onMonthSelect={setSelectedMonth}
              matrixAttendances={matrixAttendances}
              periodSummary={periodSummary}
              startDate={periodRange.startDate}
              endDate={periodRange.endDate}
            />
          </div>

          {/* 오른쪽 영역: 셀원 + 엑셀 추출 */}
          <div className="space-y-6">
            {/* 셀원 목록 카드 */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between border-b border-gray-100">
                <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
                  셀원 목록 ({cell.members.length}명)
                </h3>
                {user?.role === "EXECUTIVE" && (
                  <button
                    onClick={() => setAddMemberModalOpen(true)}
                    className="px-3 py-1.5 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                  >
                    + 셀원 추가
                  </button>
                )}
              </div>
              <div className="border-t border-gray-100">
                {sortedMembers.length > 0 ? (
                  <ul className="divide-y divide-gray-200">
                    {sortedMembers.map((member) => (
                      <li
                        key={member.id}
                        className="px-4 py-3 sm:px-6 flex items-center justify-between"
                      >
                        <div className="flex items-center flex-1 min-w-0">
                          <button
                            onClick={() =>
                              navigate(`/admin/users/${member.id}`)
                            }
                            className="text-sm text-indigo-600 hover:text-indigo-900 truncate text-left"
                          >
                            {formatNameWithBirthdate(member)}
                          </button>
                          <span className="ml-2 text-xs sm:text-sm text-gray-500 flex-shrink-0">
                            (
                            {member.gender
                              ? member.gender.toUpperCase() === "MALE"
                                ? "남"
                                : "여"
                              : ""}
                            )
                          </span>
                        </div>
                        <div className="ml-3 flex-shrink-0 flex gap-2">
                          {member.id === cell.leader?.id && (
                            <span className="text-[10px] sm:text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                              셀장
                            </span>
                          )}
                          {member.id === cell.viceLeader?.id && (
                            <span className="text-[10px] sm:text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              예비셀장
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 sm:px-6 py-4 text-sm text-gray-500">
                    이 셀에 등록된 셀원이 없습니다.
                  </p>
                )}
              </div>
            </div>

            {/* 데이터 추출 카드 (renderExportCard 호출) */}
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="px-4 py-4 sm:px-6 border-b border-gray-100">
                <h3 className="text-base sm:text-lg leading-6 font-medium text-gray-900">
                  데이터 추출 (xlsx)
                </h3>
              </div>
              <div className="p-4 sm:p-6 space-y-4">
                <div>
                  <button
                    onClick={handleExportMembers}
                    className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    셀 멤버 명단 다운로드
                  </button>
                </div>
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    출석 현황 다운로드 기간
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 space-y-2 sm:space-y-0">
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="p-2 border rounded-md w-full text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="text-center text-gray-500 text-sm">~</span>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="p-2 border rounded-md w-full text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleExportAttendances}
                    className="w-full mt-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                  >
                    출석 현황 다운로드
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 뒤로가기 버튼 */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default CellDetailPage;
