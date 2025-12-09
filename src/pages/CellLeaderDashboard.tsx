
import React, { useState, useEffect, useCallback } from 'react';
import { cellService } from '../services/cellService'; // Import cellService
import type { CellLeaderDashboardDto, User, AttendanceSummaryQueryParams } from '../types'; // Updated import for CellLeaderDashboardDto and AttendanceSummaryQueryParams
import { FaChartBar, FaUsers, FaUserCheck, FaExclamationTriangle } from 'react-icons/fa'; // Removed unused icons

interface CellLeaderDashboardProps {
  user: User;
}

type Period = 'month' | 'default' | 'year';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center">
    <div className="bg-indigo-100 text-indigo-600 p-4 rounded-full mr-6">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

const CellLeaderDashboard: React.FC<CellLeaderDashboardProps> = ({ user }) => {
  const [period, setPeriod] = useState<Period>('default');
  const [dashboardSummary, setDashboardSummary] = useState<CellLeaderDashboardDto | null>(null); // New state for dashboard summary
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => { // Renamed from fetchCellStats
    if (!user || !user.cellId) {
      setLoading(false);
      setError("셀 정보를 찾을 수 없습니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const now = new Date();
    let params: AttendanceSummaryQueryParams = {}; // Changed type to AttendanceSummaryQueryParams

    switch (period) {
      case 'month':
        params.year = now.getFullYear();
        params.month = now.getMonth() + 1;
        break;
      case 'year':
        params.year = now.getFullYear();
        break;
      case 'default':
        // No params needed, backend defaults to active semester
        break;
    }

    try {
      // Call the new API
      const data = await cellService.getDashboardSummary(user.cellId, params);
      setDashboardSummary(data);
    } catch (err) {
      console.error(err);
      setError('대시보드 요약 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500" />
        </div>
      );
    }

    if (error) {
      return <div className="text-red-500 text-center p-4">{error}</div>;
    }

    if (!dashboardSummary) {
      return <div className="text-gray-500 text-center p-4">데이터가 없습니다.</div>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="총 출석 인원 (연인원)"
          value={dashboardSummary.presentRecords.toLocaleString()}
          icon={<FaUserCheck size={24} />}
        />
        <StatCard 
          title="현재 셀 멤버 수"
          value={dashboardSummary.totalMembers.toLocaleString()}
          icon={<FaUsers size={24} />}
        />
        <StatCard 
          title="기간 내 출석률"
          value={`${dashboardSummary.attendanceRate.toFixed(1)}%`}
          icon={<FaChartBar size={24} />}
        />
        <StatCard 
          title="미완료 출석 체크 주수"
          value={`${dashboardSummary.incompleteCheckCount} 주`}
          icon={<FaExclamationTriangle size={24} />}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">우리 셀 대시보드</h2>
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          {(['month', 'default', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${
                period === p
                  ? "bg-white text-indigo-700 shadow"
                  : "text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p === 'month' && '이번 달'}
              {p === 'default' && '현재 학기'}
              {p === 'year' && '올해'}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default CellLeaderDashboard;
