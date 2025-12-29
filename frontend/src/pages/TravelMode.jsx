import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function TravelMode() {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [safeItems, setSafeItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [showItemPicker, setShowItemPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, safeRes, itemsRes] = await Promise.all([
        api.get('/travel/status'),
        api.get('/travel/safe-items'),
        api.get('/vault')
      ]);
      setStatus(statusRes.data);
      setSafeItems(safeRes.data);
      setAllItems(itemsRes.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!confirm('确定要启用旅行模式吗？启用后，未在安全列表中的密码将被隐藏。')) return;
    try {
      await api.post('/travel/activate', {
        duration_hours: duration || null
      });
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '启用失败');
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('确定要禁用旅行模式吗？')) return;
    try {
      await api.post('/travel/deactivate');
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '禁用失败');
    }
  };

  const handleAddToSafe = async (itemId) => {
    try {
      await api.post('/travel/safe-items', { item_id: itemId, item_type: 'password' });
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '添加失败');
    }
  };

  const handleRemoveFromSafe = async (itemId) => {
    try {
      await api.delete(`/travel/safe-items/${itemId}`);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '移除失败');
    }
  };

  const safeItemIds = safeItems.map(i => i.item_id);

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
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
              ← 返回
            </button>
            <h1 className="text-xl font-bold">旅行模式</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 状态卡片 */}
        <div className={`rounded-lg shadow p-6 ${status?.isActive ? 'bg-orange-50 border-2 border-orange-500' : 'bg-white'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`text-4xl ${status?.isActive ? 'animate-pulse' : ''}`}>
                {status?.isActive ? '✈️' : '🏠'}
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {status?.isActive ? '旅行模式已启用' : '旅行模式已关闭'}
                </h2>
                <p className="text-gray-600">
                  {status?.isActive
                    ? '只有安全列表中的密码可见'
                    : '所有密码正常显示'}
                </p>
                {status?.isActive && status?.activatedAt && (
                  <p className="text-sm text-orange-600 mt-1">
                    启用于: {new Date(status.activatedAt).toLocaleString()}
                  </p>
                )}
                {status?.isActive && status?.autoDisableAt && (
                  <p className="text-sm text-orange-600">
                    自动关闭: {new Date(status.autoDisableAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div>
              {status?.isActive ? (
                <button
                  onClick={handleDeactivate}
                  className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  关闭旅行模式
                </button>
              ) : (
                <div className="text-right">
                  <div className="mb-2">
                    <label className="text-sm text-gray-600 mr-2">自动关闭:</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                      className="px-3 py-1 border rounded"
                    >
                      <option value={0}>不自动关闭</option>
                      <option value={24}>24小时后</option>
                      <option value={72}>3天后</option>
                      <option value={168}>7天后</option>
                      <option value={336}>14天后</option>
                    </select>
                  </div>
                  <button
                    onClick={handleActivate}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    启用旅行模式
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">什么是旅行模式？</h3>
          <p className="text-sm text-blue-800 mb-2">
            旅行模式专为跨境旅行设计。当您经过边境检查站时，可能被要求解锁设备展示内容。
            启用旅行模式后，敏感密码将被隐藏，只显示安全列表中的密码。
          </p>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>在出发前将必要的密码添加到安全列表</li>
            <li>启用旅行模式隐藏敏感信息</li>
            <li>到达目的地后关闭旅行模式恢复正常</li>
          </ul>
        </div>

        {/* 安全列表 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">安全列表 ({safeItems.length} 项)</h3>
            <button
              onClick={() => setShowItemPicker(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              添加项目
            </button>
          </div>
          {safeItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p>安全列表为空</p>
              <p className="text-sm">添加旅行时需要访问的密码</p>
            </div>
          ) : (
            <div className="divide-y">
              {safeItems.map(item => (
                <div key={item.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">{item.website}</div>
                  </div>
                  <button
                    onClick={() => handleRemoveFromSafe(item.item_id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 项目选择器 */}
      {showItemPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">选择要添加的密码</h3>
              <button onClick={() => setShowItemPicker(false)} className="text-gray-400">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {allItems.filter(item => !safeItemIds.includes(item.id)).length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  所有密码都已在安全列表中
                </div>
              ) : (
                <div className="divide-y">
                  {allItems.filter(item => !safeItemIds.includes(item.id)).map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleAddToSafe(item.id);
                        setShowItemPicker(false);
                      }}
                      className="w-full p-4 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-gray-500">{item.website}</div>
                      </div>
                      <span className="text-green-600">+ 添加</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
