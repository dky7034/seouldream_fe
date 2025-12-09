import React, { useState } from 'react';
import { prayerService } from '../../services/prayerService';
import { useAuth } from '../../hooks/useAuth';
import type { CreatePrayerRequest, PrayerVisibility } from '../../types';

interface InlinePrayerFormProps {
  memberId: number;
  onSave: () => void;
  onCancel: () => void;
}

const InlinePrayerForm: React.FC<InlinePrayerFormProps> = ({ memberId, onSave, onCancel }) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<PrayerVisibility>('CELL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!content.trim() || !user) {
      setError('기도제목을 입력해주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: CreatePrayerRequest = {
        memberId,
        content,
        visibility,
        createdById: user.id,
      };
      await prayerService.createPrayer(payload);
      onSave(); // Notify parent
    } catch (err) {
      setError('기도제목 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 space-y-3">
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="기도제목을 입력하세요..."
        className="w-full p-2 border rounded-md"
        rows={3}
      />
      <div className="flex justify-between items-center">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">공개범위:</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as PrayerVisibility)}
            className="p-2 border rounded-md text-sm"
          >
            <option value="CELL">셀 공개</option>
            <option value="ALL">전체 공개</option>
            <option value="PRIVATE">비공개</option>
          </select>
        </div>
        <div className="space-x-2">
          <button onClick={onCancel} className="px-3 py-1 text-sm bg-gray-200 rounded-md">취소</button>
          <button onClick={handleSubmit} disabled={loading} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded-md disabled:bg-indigo-300">
            {loading ? '저장 중...' : '기도 저장'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlinePrayerForm;
