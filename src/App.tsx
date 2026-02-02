// src/App.tsx
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./components/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ExecOnlyRoute from "./components/ExecOnlyRoute";

import "react-datepicker/dist/react-datepicker.css";
import "./styles/datepicker-tailwind.css";

const LoginPage = lazy(() => import("./pages/LoginPage"));
// const RegisterPage = lazy(() => import("./pages/RegisterPage"));

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AddUserPage = lazy(() => import("./pages/AddUserPage"));
const EditMemberPage = lazy(() => import("./pages/EditMemberPage"));
const MemberDetailPage = lazy(() => import("./pages/MemberDetailPage"));
const MemberAttendanceHistoryPage = lazy(
  () => import("./pages/MemberAttendanceHistoryPage"),
);
const AdminTeamsPage = lazy(() => import("./pages/AdminTeamsPage"));
const AddTeamPage = lazy(() => import("./pages/AddTeamPage"));
const EditTeamPage = lazy(() => import("./pages/EditTeamPage"));
const TeamDetailPage = lazy(() => import("./pages/TeamDetailPage"));
const AdminCellsPage = lazy(() => import("./pages/AdminCellsPage"));
const AddCellPage = lazy(() => import("./pages/AddCellPage"));
const EditCellPage = lazy(() => import("./pages/EditCellPage"));
const CellDetailPage = lazy(() => import("./pages/CellDetailPage"));
const AdminAttendancesPage = lazy(() => import("./pages/AdminAttendancesPage"));
const ProcessAttendancePage = lazy(
  () => import("./pages/ProcessAttendancePage"),
);
const AttendanceAlertsPage = lazy(() => import("./pages/AttendanceAlertsPage"));
const AdminPrayersPage = lazy(() => import("./pages/AdminPrayersPage"));
const AddPrayerPage = lazy(() => import("./pages/AddPrayerPage"));
const PrayerDetailPage = lazy(() => import("./pages/PrayerDetailPage"));
const EditPrayerPage = lazy(() => import("./pages/EditPrayerPage"));
const AdminNoticesPage = lazy(() => import("./pages/AdminNoticesPage"));
const AddNoticePage = lazy(() => import("./pages/AddNoticePage"));
const EditNoticePage = lazy(() => import("./pages/EditNoticePage"));
const NoticeDetailPage = lazy(() => import("./pages/NoticeDetailPage"));
const MyCellPage = lazy(() => import("./pages/MyCellPage"));
const AdminSemestersPage = lazy(() => import("./pages/AdminSemestersPage"));
const AdminIncompleteChecksReportPage = lazy(
  () => import("./pages/AdminIncompleteChecksReportPage"),
);
const MemberPrayersPage = lazy(() => import("./pages/MemberPrayersPage"));
const CellPrayersPage = lazy(() => import("./pages/CellPrayersPage"));
const AdminPrayerSummaryPage = lazy(
  () => import("./pages/AdminPrayerSummaryPage"),
);
const CellLeaderDashboard = lazy(() => import("./pages/CellLeaderDashboard"));
const StatisticsPage = lazy(() => import("./pages/StatisticsPage"));

const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-lg font-semibold text-gray-500">페이지 로딩 중...</div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<Navigate to="/" replace />} />

          {/* Protected routes (로그인한 모든 사용자) */}
          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/my-cell" element={<MyCellPage />} />
              <Route path="/cell-dashboard" element={<CellLeaderDashboard />} />

              {/* 멤버 상세 및 출석 기록 */}
              <Route path="/admin/users/:id" element={<MemberDetailPage />} />
              <Route
                path="/admin/users/:id/edit"
                element={<EditMemberPage />}
              />
              <Route
                path="/admin/users/:id/attendance"
                element={<MemberAttendanceHistoryPage />}
              />

              {/* 기도제목 상세 */}
              <Route path="/admin/prayers/:id" element={<PrayerDetailPage />} />
              <Route
                path="/admin/prayers/:id/edit"
                element={<EditPrayerPage />}
              />

              {/* 멤버별/셀별 기도제목 모음 */}
              <Route
                path="/admin/prayers/members/:memberId"
                element={<MemberPrayersPage />}
              />
              <Route
                path="/admin/prayers/cells/:cellId"
                element={<CellPrayersPage />}
              />

              {/* 공지사항 목록 & 상세 */}
              <Route path="/admin/notices" element={<AdminNoticesPage />} />
              <Route
                path="/admin/notices/:noticeId"
                element={<NoticeDetailPage />}
              />

              {/* --- [관리자(EXECUTIVE) 전용] --- */}
              <Route element={<ExecOnlyRoute />}>
                {/* 통계 및 리포트 페이지 */}
                <Route path="/admin/statistics" element={<StatisticsPage />} />

                {/* 사용자 관리 */}
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/users/add" element={<AddUserPage />} />

                {/* 팀 관리 */}
                <Route path="/admin/teams" element={<AdminTeamsPage />} />
                <Route path="/admin/teams/add" element={<AddTeamPage />} />
                <Route path="/admin/teams/:id" element={<TeamDetailPage />} />
                <Route
                  path="/admin/teams/:id/edit"
                  element={<EditTeamPage />}
                />

                {/* 셀 관리 */}
                <Route path="/admin/cells" element={<AdminCellsPage />} />
                <Route path="/admin/cells/add" element={<AddCellPage />} />
                <Route path="/admin/cells/:id" element={<CellDetailPage />} />
                <Route
                  path="/admin/cells/:id/edit"
                  element={<EditCellPage />}
                />

                {/* 학기 관리 */}
                <Route
                  path="/admin/semesters"
                  element={<AdminSemestersPage />}
                />

                {/* 출석 관리 */}
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

                {/* 결석 관리 페이지 */}
                <Route
                  path="/admin/attendance-alerts"
                  element={<AttendanceAlertsPage />}
                />

                {/* 기도제목 리스트 & 관리 */}
                <Route path="/admin/prayers" element={<AdminPrayersPage />} />
                <Route path="/admin/prayers/add" element={<AddPrayerPage />} />

                {/* ✅ [수정완료] initialMode 속성을 제거했습니다 */}
                <Route
                  path="/admin/prayers/summary/members"
                  element={<AdminPrayerSummaryPage />}
                />
                <Route
                  path="/admin/prayers/summary/cells"
                  element={<AdminPrayerSummaryPage />}
                />

                {/* 공지사항 추가/수정 */}
                <Route path="/admin/notices/add" element={<AddNoticePage />} />
                <Route
                  path="/admin/notices/:id/edit"
                  element={<EditNoticePage />}
                />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
