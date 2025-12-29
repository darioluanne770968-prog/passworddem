import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Sessions() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        api.get('/sessions'),
        api.get('/sessions/stats')
      ]);
      setSessions(sessionsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (id) => {
    if (!confirm('确定要撤销此会话吗？该设备将需要重新登录。')) return;
    try {
      await api.delete(`/sessions/${id}`);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '撤销失败');
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('确定要撤销所有其他会话吗？所有设备都需要重新登录。')) return;
    try {
      await api.post('/sessions/revoke-all');
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '撤销失败');
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile': return '📱';
      case 'tablet': return '📟';
      case 'desktop':
      default: return '💻';
    }
  };

  const getBrowserIcon = (browser) => {
    if (!browser) return '🌐';
    const b = browser.toLowerCase();
    if (b.includes('chrome')) return '🔵';
    if (b.includes('firefox')) return '🦊';
    if (b.includes('safari')) return '🧭';
    if (b.includes('edge')) return '🔷';
    return '🌐';
  };

  const formatLastActive = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">会话管理</h1>
            </div>
            {sessions.filter(s => !s.is_current).length > 0 && (
              <button
                onClick={handleRevokeAll}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                撤销所有其他会话
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-500">总会话数</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.activeIn24h}</div>
              <div className="text-sm text-gray-500">24小时内活跃</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {stats.byDevice?.length || 0}
              </div>
              <div className="text-sm text-gray-500">设备类型</div>
            </div>
          </div>
        )}

        {/* 会话列表 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">活动会话</h2>
          </div>
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              暂无会话记录
            </div>
          ) : (
            <div className="divide-y">
              {sessions.map(session => (
                <div
                  key={session.id}
                  className={`p-4 ${session.is_current ? 'bg-green-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl">
                        {getDeviceIcon(session.device_type)}
                      </div>
                      <div>
                        <div className="font-medium flex items-center">
                          {session.device_name || session.os || '未知设备'}
                          {session.is_current && (
                            <span className="ml-2 px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                              当前设备
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center space-x-3 mt-1">
                          <span>{getBrowserIcon(session.browser)} {session.browser}</span>
                          <span>•</span>
                          <span>{session.os}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          <span>IP: {session.ip_address || '未知'}</span>
                          {session.location && session.location !== '未知' && (
                            <span className="ml-2">📍 {session.location}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          最后活动: {formatLastActive(session.last_active)}
                          <span className="mx-2">•</span>
                          登录时间: {new Date(session.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    {!session.is_current && (
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="px-3 py-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        撤销
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 安全提示 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-2">安全提示</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>如果发现不认识的会话，请立即撤销并修改密码</li>
            <li>定期检查活动会话可以帮助发现未授权的访问</li>
            <li>在公共设备上使用后，记得退出登录</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
