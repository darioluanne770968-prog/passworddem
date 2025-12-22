import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function BreachMonitor() {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMonitor, setNewMonitor] = useState({ type: 'email', value: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [monitorsRes, alertsRes] = await Promise.all([
        api.get('/breach/monitors'),
        api.get('/breach/alerts')
      ]);
      setMonitors(monitorsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    try {
      await api.post('/breach/check');
      await loadData();
    } catch (error) {
      console.error('检查失败:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleAddMonitor = async (e) => {
    e.preventDefault();
    try {
      await api.post('/breach/monitors', newMonitor);
      setNewMonitor({ type: 'email', value: '' });
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '添加失败');
    }
  };

  const handleDeleteMonitor = async (id) => {
    if (!confirm('确定删除此监控项？')) return;
    try {
      await api.delete(`/breach/monitors/${id}`);
      await loadData();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const markAlertRead = async (id) => {
    try {
      await api.patch(`/breach/alerts/${id}/read`);
      setAlerts(alerts.map(a => a.id === id ? { ...a, is_read: 1 } : a));
    } catch (error) {
      console.error('标记失败:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const unreadCount = alerts.filter(a => !a.is_read).length;

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
              <h1 className="text-xl font-bold">暗网监控</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount} 新警报
                </span>
              )}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加监控
              </button>
              <button
                onClick={handleCheck}
                disabled={checking}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {checking ? '检查中...' : '立即检查'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 监控项列表 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">监控项目</h2>
          {monitors.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              暂无监控项，点击"添加监控"开始保护您的账号安全
            </p>
          ) : (
            <div className="space-y-3">
              {monitors.map(monitor => (
                <div key={monitor.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500 uppercase">{monitor.monitor_type}</span>
                      <span className="font-medium">{monitor.monitor_value}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {monitor.breach_count > 0 ? (
                        <span className="text-red-600">发现 {monitor.breach_count} 次泄露</span>
                      ) : (
                        <span className="text-green-600">未发现泄露</span>
                      )}
                      {monitor.last_checked && (
                        <span className="ml-2">· 上次检查: {new Date(monitor.last_checked).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMonitor(monitor.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 泄露警报 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">泄露警报</h2>
          {alerts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暂无警报，您的账号很安全！</p>
          ) : (
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    alert.is_read ? 'bg-gray-50 border-gray-300' : 'bg-red-50 border-red-500'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium">{alert.breach_name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {alert.monitor_value} ({alert.monitor_type})
                      </p>
                      {alert.breach_data?.Description && (
                        <p className="text-sm text-gray-500 mt-2">{alert.breach_data.Description}</p>
                      )}
                      {alert.breach_data?.DataClasses && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {alert.breach_data.DataClasses.map((dc, i) => (
                            <span key={i} className="text-xs bg-gray-200 px-2 py-1 rounded">
                              {dc}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {!alert.is_read && (
                      <button
                        onClick={() => markAlertRead(alert.id)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        标记已读
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    泄露日期: {alert.breach_date || '未知'} · 发现时间: {new Date(alert.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 添加监控表单 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加监控项</h3>
            <form onSubmit={handleAddMonitor} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">监控类型</label>
                <select
                  value={newMonitor.type}
                  onChange={(e) => setNewMonitor({ ...newMonitor, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="email">邮箱</option>
                  <option value="phone">手机号</option>
                  <option value="username">用户名</option>
                  <option value="domain">域名</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">监控值</label>
                <input
                  type="text"
                  value={newMonitor.value}
                  onChange={(e) => setNewMonitor({ ...newMonitor, value: e.target.value })}
                  placeholder={newMonitor.type === 'email' ? 'your@email.com' : '输入要监控的内容'}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
