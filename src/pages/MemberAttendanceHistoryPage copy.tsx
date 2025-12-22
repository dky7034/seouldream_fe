import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { attendanceService } from '../services/attendanceService'; // Import attendanceService
import type { MemberAttendanceSummaryDto, MemberPeriodSummaryDto, GroupBy } from '../types';
import { useAuth } from '../hooks/useAuth';
import { translateAttendanceStatus } from '../utils/attendanceUtils';

type SortConfig = {
  key: keyof MemberPeriodSummaryDto;
  direction: 'ascending' | 'descending';
};

const MemberAttendanceHistoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<MemberAttendanceSummaryDto | null>(null);
  
  const today = new Date();
  const oneYearAgo = new Date(new Date().setFullYear(today.getFullYear() - 1));
  const [startDate, setStartDate] = useState(oneYearAgo.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  
  const [groupBy, setGroupBy] = useState<GroupBy>('DAY');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dateGroup', direction: 'descending' });

  const memberIdNum = Number(id);

  const fetchAttendanceHistory = useCallback(async () => {
    if (!user || !memberIdNum) return;

    setLoading(true);
    try {
      const data = await attendanceService.getMemberAttendanceSummary(memberIdNum, {
        startDate,
        endDate,
        groupBy,
      });
      setSummary(data);
    } catch (err) {
      setError('출석 기록을 불러오는 데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user, memberIdNum, startDate, endDate, groupBy]);

  useEffect(() => {
    fetchAttendanceHistory();
  }, [fetchAttendanceHistory]);
  
  const sortedSummaries = useMemo(() => {
    if (!summary) return [];
    return [...summary.periodSummaries].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      if (aValue === undefined || aValue === null) return 1;
      if (bValue === undefined || bValue === null) return -1;
      if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
  }, [summary, sortConfig]);

  const requestSort = (key: keyof MemberPeriodSummaryDto) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof MemberPeriodSummaryDto) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };
  
  if (loading) return <p>로딩 중...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{summary?.memberName}님 출석 기록</h1>
      
      <div className="mb-4 p-4 bg-gray-50 rounded-lg flex items-end justify-between">
        <div className='flex items-end space-x-4'>
            <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">시작일</label>
                <input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded-md"/>
            </div>
            <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">종료일</label>
                <input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded-md"/>
            </div>
        </div>
        <div className="flex items-center space-x-1 border border-gray-300 rounded-lg p-1">
            <button onClick={() => setGroupBy('DAY')} className={`px-3 py-1 text-sm rounded-md ${groupBy === 'DAY' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>일별</button>
            <button onClick={() => setGroupBy('MONTH')} className={`px-3 py-1 text-sm rounded-md ${groupBy === 'MONTH' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>월별</button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {groupBy === 'DAY' ? (
                <tr>
                    <th onClick={() => requestSort('dateGroup')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">날짜 {getSortIndicator('dateGroup')}</th>
                    <th onClick={() => requestSort('status')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">상태 {getSortIndicator('status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">메모</th>
                </tr>
            ) : (
                <tr>
                    <th onClick={() => requestSort('dateGroup')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">월 {getSortIndicator('dateGroup')}</th>
                    <th onClick={() => requestSort('presentCount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">출석 {getSortIndicator('presentCount')}</th>
                    <th onClick={() => requestSort('absentCount')} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer">결석 {getSortIndicator('absentCount')}</th>
                </tr>
            )}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedSummaries.map((item: MemberPeriodSummaryDto, index: number) => (
                <tr key={index}>
                    {groupBy === 'DAY' ? (
                        <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.dateGroup}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {item.status && (
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                item.status === 'PRESENT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                {translateAttendanceStatus(item.status)}
                                </span>
                            )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.memo || '-'}</td>
                        </>
                    ) : (
                        <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.dateGroup}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{item.presentCount || 0}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">{item.absentCount || 0}</td>
                        </>
                    )}
                </tr>
            ))}
          </tbody>
        </table>
        {sortedSummaries.length === 0 && <p className="text-center py-4">해당 기간의 출석 기록이 없습니다.</p>}
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={() => navigate(-1)} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">뒤로 가기</button>
      </div>
    </div>
  );
};

export default MemberAttendanceHistoryPage;