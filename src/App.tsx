import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AddUserPage from "./pages/AddUserPage";
import EditMemberPage from "./pages/EditMemberPage";
import MemberDetailPage from "./pages/MemberDetailPage";
import MemberAttendanceHistoryPage from "./pages/MemberAttendanceHistoryPage";
import AdminTeamsPage from "./pages/AdminTeamsPage";
import AddTeamPage from "./pages/AddTeamPage";
import EditTeamPage from "./pages/EditTeamPage";
import TeamDetailPage from "./pages/TeamDetailPage";
import AdminCellsPage from "./pages/AdminCellsPage";
import AddCellPage from "./pages/AddCellPage";
import EditCellPage from "./pages/EditCellPage";
import CellDetailPage from "./pages/CellDetailPage";
import AdminAttendancesPage from "./pages/AdminAttendancesPage";
import ProcessAttendancePage from "./pages/ProcessAttendancePage";
import AttendanceAlertsPage from "./pages/AttendanceAlertsPage";
import AdminPrayersPage from "./pages/AdminPrayersPage";
import AddPrayerPage from "./pages/AddPrayerPage";
import PrayerDetailPage from "./pages/PrayerDetailPage";
import EditPrayerPage from "./pages/EditPrayerPage";
import AdminNoticesPage from "./pages/AdminNoticesPage";
import AddNoticePage from "./pages/AddNoticePage";
import EditNoticePage from "./pages/EditNoticePage";
import NoticeDetailPage from "./pages/NoticeDetailPage";
import MyProfilePage from "./pages/MyProfilePage";
import MyCellPage from "./pages/MyCellPage";
import MainLayout from "./components/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ExecOnlyRoute from "./components/ExecOnlyRoute";
import AdminSemestersPage from "./pages/AdminSemestersPage";
import AdminIncompleteChecksReportPage from "./pages/AdminIncompleteChecksReportPage";
import BirthdaysPage from "./pages/BirthdaysPage";
import MemberPrayersPage from "./pages/MemberPrayersPage";
import CellPrayersPage from "./pages/CellPrayersPage";
import AdminPrayerSummaryPage from "./pages/AdminPrayerSummaryPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* 공통 접근 가능 라우트 */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/my-profile" element={<MyProfilePage />} />
            <Route path="/my-cell" element={<MyCellPage />} />
            <Route path="/birthdays" element={<BirthdaysPage />} />
            {/* ✅ 임원(EXECUTIVE) 전용 라우트 그룹 */}
            <Route element={<ExecOnlyRoute />}>
              {/* 사용자 관리 */}
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/users/add" element={<AddUserPage />} />
              <Route path="/admin/users/:id" element={<MemberDetailPage />} />
              <Route
                path="/admin/users/:id/attendance"
                element={<MemberAttendanceHistoryPage />}
              />
              <Route
                path="/admin/users/:id/edit"
                element={<EditMemberPage />}
              />

              {/* 팀 관리 */}
              <Route path="/admin/teams" element={<AdminTeamsPage />} />
              <Route path="/admin/teams/add" element={<AddTeamPage />} />
              <Route path="/admin/teams/:id" element={<TeamDetailPage />} />
              <Route path="/admin/teams/:id/edit" element={<EditTeamPage />} />

              {/* 셀 관리 */}
              <Route path="/admin/cells" element={<AdminCellsPage />} />
              <Route path="/admin/cells/add" element={<AddCellPage />} />
              <Route path="/admin/cells/:id" element={<CellDetailPage />} />
              <Route path="/admin/cells/:id/edit" element={<EditCellPage />} />

              {/* ✅ 학기 관리 */}
              <Route path="/admin/semesters" element={<AdminSemestersPage />} />

              {/* ✅ 출석 리포트 */}
              <Route
                path="/admin/attendances"
                element={<AdminAttendancesPage />}
              />
              <Route
                path="/admin/attendances/process"
                element={<ProcessAttendancePage />}
              />
              <Route
                path="/admin/incomplete-checks-report"
                element={<AdminIncompleteChecksReportPage />}
              />
              {/* ✅ 기도제목 전체 리스트 (기존 그대로 유지) */}
              <Route path="/admin/prayers" element={<AdminPrayersPage />} />

              {/* ✅ 기도제목 요약 페이지 (새로 추가) */}
              <Route
                path="/admin/prayers/summary/members"
                element={<AdminPrayerSummaryPage initialMode="members" />}
              />
              <Route
                path="/admin/prayers/summary/cells"
                element={<AdminPrayerSummaryPage initialMode="cells" />}
              />
            </Route>
            {/* ✅ 임원 + 셀장 공통 */}
            <Route
              path="/admin/attendance-alerts"
              element={<AttendanceAlertsPage />}
            />
            // 기도제목 관리
            <Route path="/admin/prayers" element={<AdminPrayersPage />} />
            <Route path="/admin/prayers/add" element={<AddPrayerPage />} />
            <Route path="/admin/prayers/:id" element={<PrayerDetailPage />} />
            <Route
              path="/admin/prayers/:id/edit"
              element={<EditPrayerPage />}
            />
            {/* ✅ 멤버/셀 요약 탭을 별도 경로로 추가 */}
            <Route
              path="/admin/prayers/summary/members"
              element={<AdminPrayersPage />}
            />
            <Route
              path="/admin/prayers/summary/cells"
              element={<AdminPrayersPage />}
            />
            {/* 멤버별 / 셀별 기도제목 상세 페이지 */}
            <Route
              path="/admin/prayers/members/:memberId"
              element={<MemberPrayersPage />}
            />
            <Route
              path="/admin/prayers/cells/:cellId"
              element={<CellPrayersPage />}
            />
            {/* 공지사항 */}
            <Route path="/admin/notices" element={<AdminNoticesPage />} />
            <Route path="/admin/notices/add" element={<AddNoticePage />} />
            <Route
              path="/admin/notices/:noticeId"
              element={<NoticeDetailPage />}
            />
            <Route
              path="/admin/notices/:id/edit"
              element={<EditNoticePage />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
