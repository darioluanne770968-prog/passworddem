import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function RecoveryCodes() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [accountStatus, setAccountStatus] = useState(null);
  const [generatedCodes, setGeneratedCodes] = useState(null);
  const [storedCodes, setStoredCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedStored, setSelectedStored] = useState(null);
  const [newStored, setNewStored] = useState({
    service_name: '',
    codes: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, storedRes] = await Promise.all([
        api.get('/recovery/status'),
        api.get('/recovery/stored')
      ]);
      setAccountStatus(statusRes.data);
      setStoredCodes(storedRes.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCodes = async () => {
    if (accountStatus?.hasRecoveryCodes) {
      if (!confirm('生成新的恢复码将使旧的恢复码失效。确定继续吗？')) return;
    }
    try {
      const res = await api.post('/recovery/generate');
      setGeneratedCodes(res.data.codes);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '生成失败');
    }
  };

  const handleSaveStored = async (e) => {
    e.preventDefault();
    try {
      if (selectedStored) {
        await api.put(`/recovery/stored/${selectedStored.id}`, newStored);
      } else {
        await api.post('/recovery/stored', newStored);
      }
      setShowAddForm(false);
      setSelectedStored(null);
      setNewStored({ service_name: '', codes: '', notes: '' });
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleDeleteStored = async (id) => {
    if (!confirm('确定删除此恢复码？')) return;
    try {
      await api.delete(`/recovery/stored/${id}`);
      setSelectedStored(null);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleViewStored = async (id) => {
    try {
      const res = await api.get(`/recovery/stored/${id}`);
      setSelectedStored(res.data);
    } catch (error) {
      alert('加载失败');
    }
  };

  const handleCopyCodes = (codes) => {
    const text = Array.isArray(codes) ? codes.join('\n') : codes;
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const handleDownloadCodes = (codes, filename) => {
    const text = Array.isArray(codes) ? codes.join('\n') : codes;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
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
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
              ← 返回
            </button>
            <h1 className="text-xl font-bold">恢复码管理</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 标签切换 */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-1 py-2 px-4 rounded-md transition ${
              activeTab === 'account'
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            账户恢复码
          </button>
          <button
            onClick={() => setActiveTab('stored')}
            className={`flex-1 py-2 px-4 rounded-md transition ${
              activeTab === 'stored'
                ? 'bg-white shadow text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            第三方恢复码
          </button>
        </div>

        {/* 账户恢复码 */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            {generatedCodes ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-green-600">恢复码已生成!</h2>
                  <button
                    onClick={() => setGeneratedCodes(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="grid grid-cols-2 gap-2 font-mono text-center">
                    {generatedCodes.map((code, index) => (
                      <div key={index} className="bg-white p-2 rounded border">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-red-800 font-medium">
                    ⚠️ 这些恢复码只显示一次！请立即保存到安全的地方。
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => handleCopyCodes(generatedCodes)}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    复制全部
                  </button>
                  <button
                    onClick={() => handleDownloadCodes(generatedCodes, 'recovery-codes.txt')}
                    className="flex-1 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    下载文件
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">账户恢复码</h2>
                {accountStatus?.hasRecoveryCodes ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <div className="font-medium text-green-800">已设置恢复码</div>
                        <div className="text-sm text-green-600">
                          剩余 {accountStatus.remaining} / {accountStatus.total} 个可用
                        </div>
                      </div>
                      <span className="text-3xl">✅</span>
                    </div>
                    <button
                      onClick={handleGenerateCodes}
                      className="w-full py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                    >
                      重新生成恢复码
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                      <div>
                        <div className="font-medium text-yellow-800">未设置恢复码</div>
                        <div className="text-sm text-yellow-600">
                          建议生成恢复码以防忘记密码
                        </div>
                      </div>
                      <span className="text-3xl">⚠️</span>
                    </div>
                    <button
                      onClick={handleGenerateCodes}
                      className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      生成恢复码
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">什么是恢复码？</h3>
              <p className="text-sm text-blue-800">
                恢复码是一组一次性使用的代码，当您无法使用密码登录时（如忘记密码），
                可以使用恢复码来恢复对账户的访问。每个恢复码只能使用一次。
              </p>
            </div>
          </div>
        )}

        {/* 第三方恢复码存储 */}
        {activeTab === 'stored' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setNewStored({ service_name: '', codes: '', notes: '' });
                  setShowAddForm(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                添加恢复码
              </button>
            </div>

            {storedCodes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="text-6xl mb-4">🔐</div>
                <h2 className="text-xl font-semibold mb-2">暂无存储的恢复码</h2>
                <p className="text-gray-500">
                  在这里安全存储第三方服务的恢复码
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow divide-y">
                {storedCodes.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleViewStored(item.id)}
                    className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">{item.service_name}</div>
                      {item.notes && (
                        <div className="text-sm text-gray-500">{item.notes}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        更新于 {new Date(item.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="text-gray-400">›</span>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-2">存储第三方恢复码</h3>
              <p className="text-sm text-yellow-800">
                很多服务（如 Google、GitHub、Discord）会提供恢复码用于账户恢复。
                在这里集中存储这些恢复码，避免丢失。
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 添加/编辑第三方恢复码 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">
                {selectedStored ? '编辑恢复码' : '添加恢复码'}
              </h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSaveStored} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">服务名称 *</label>
                <input
                  type="text"
                  value={newStored.service_name}
                  onChange={(e) => setNewStored({ ...newStored, service_name: e.target.value })}
                  placeholder="Google, GitHub, etc."
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">恢复码 *</label>
                <textarea
                  value={newStored.codes}
                  onChange={(e) => setNewStored({ ...newStored, codes: e.target.value })}
                  placeholder="每行一个恢复码..."
                  className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                  rows={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注</label>
                <input
                  type="text"
                  value={newStored.notes}
                  onChange={(e) => setNewStored({ ...newStored, notes: e.target.value })}
                  placeholder="可选的备注信息"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 查看第三方恢复码 */}
      {selectedStored && !showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">{selectedStored.service_name}</h3>
              <button onClick={() => setSelectedStored(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-4">
              {selectedStored.notes && (
                <p className="text-sm text-gray-500 mb-4">{selectedStored.notes}</p>
              )}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="space-y-1 font-mono text-sm">
                  {selectedStored.codes?.map((code, index) => (
                    <div key={index} className="flex items-center justify-between py-1 border-b border-gray-200 last:border-0">
                      <span>{code}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(code)}
                        className="text-blue-600 text-xs"
                      >
                        复制
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-between">
              <button
                onClick={() => handleDeleteStored(selectedStored.id)}
                className="px-3 py-1 text-red-600"
              >
                删除
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => handleCopyCodes(selectedStored.codes)}
                  className="px-3 py-1 text-blue-600"
                >
                  复制全部
                </button>
                <button
                  onClick={() => {
                    setNewStored({
                      service_name: selectedStored.service_name,
                      codes: selectedStored.codes.join('\n'),
                      notes: selectedStored.notes || ''
                    });
                    setShowAddForm(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded"
                >
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
