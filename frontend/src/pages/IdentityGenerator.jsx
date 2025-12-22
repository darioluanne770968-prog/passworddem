import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function IdentityGenerator() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(null);
  const [savedIdentities, setSavedIdentities] = useState([]);
  const [emailAliases, setEmailAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState('zh-CN');
  const [activeTab, setActiveTab] = useState('generator');

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    try {
      const [identitiesRes, aliasesRes] = await Promise.all([
        api.get('/identity/saved'),
        api.get('/identity/email-aliases')
      ]);
      setSavedIdentities(identitiesRes.data);
      setEmailAliases(aliasesRes.data);
    } catch (error) {
      console.error('加载失败:', error);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/identity/generate', { locale });
      setIdentity(res.data);
    } catch (error) {
      alert(error.response?.data?.error || '生成失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIdentity = async () => {
    if (!identity) return;
    try {
      await api.post('/identity/save', identity);
      await loadSavedData();
      alert('身份已保存');
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleDeleteIdentity = async (id) => {
    if (!confirm('确定删除此身份？')) return;
    try {
      await api.delete(`/identity/saved/${id}`);
      await loadSavedData();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleCreateAlias = async () => {
    try {
      const res = await api.post('/identity/email-aliases');
      setEmailAliases([res.data, ...emailAliases]);
    } catch (error) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const handleDeleteAlias = async (id) => {
    if (!confirm('确定删除此邮箱别名？')) return;
    try {
      await api.delete(`/identity/email-aliases/${id}`);
      await loadSavedData();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const tabs = [
    { id: 'generator', label: '身份生成器', icon: '🎭' },
    { id: 'saved', label: '已保存身份', icon: '📋' },
    { id: 'aliases', label: '邮箱别名', icon: '📧' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <div className="flex items-center space-x-4">
            <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
              ← 返回
            </button>
            <h1 className="text-xl font-bold">隐私工具</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 标签页 */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-4 rounded-md transition ${
                activeTab === tab.id
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 身份生成器 */}
        {activeTab === 'generator' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">生成虚拟身份</h2>
              <p className="text-sm text-gray-600 mb-4">
                生成随机的虚拟身份信息，用于注册不信任的网站，保护您的真实隐私。
              </p>

              <div className="flex items-center space-x-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">语言/地区</label>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value)}
                    className="px-3 py-2 border rounded-lg"
                  >
                    <option value="zh-CN">中国大陆</option>
                    <option value="zh-TW">中国台湾</option>
                    <option value="en-US">美国</option>
                    <option value="en-GB">英国</option>
                    <option value="ja-JP">日本</option>
                    <option value="ko-KR">韩国</option>
                  </select>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 mt-6"
                >
                  {loading ? '生成中...' : '生成身份'}
                </button>
              </div>

              {identity && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold">生成的身份</h3>
                    <button
                      onClick={handleSaveIdentity}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      保存身份
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500">姓名</label>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{identity.name}</span>
                          <button
                            onClick={() => handleCopy(identity.name)}
                            className="text-blue-600 text-xs hover:text-blue-800"
                          >
                            复制
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">性别</label>
                        <span>{identity.gender === 'male' ? '男' : '女'}</span>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">生日</label>
                        <div className="flex items-center justify-between">
                          <span>{identity.birthDate}</span>
                          <button
                            onClick={() => handleCopy(identity.birthDate)}
                            className="text-blue-600 text-xs hover:text-blue-800"
                          >
                            复制
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">邮箱</label>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm">{identity.email}</span>
                          <button
                            onClick={() => handleCopy(identity.email)}
                            className="text-blue-600 text-xs hover:text-blue-800"
                          >
                            复制
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500">电话</label>
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{identity.phone}</span>
                          <button
                            onClick={() => handleCopy(identity.phone)}
                            className="text-blue-600 text-xs hover:text-blue-800"
                          >
                            复制
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500">地址</label>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">{identity.address}</span>
                          <button
                            onClick={() => handleCopy(identity.address)}
                            className="text-blue-600 text-xs hover:text-blue-800"
                          >
                            复制
                          </button>
                        </div>
                      </div>
                      {identity.idNumber && (
                        <div>
                          <label className="block text-xs text-gray-500">身份证号</label>
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{identity.idNumber}</span>
                            <button
                              onClick={() => handleCopy(identity.idNumber)}
                              className="text-blue-600 text-xs hover:text-blue-800"
                            >
                              复制
                            </button>
                          </div>
                        </div>
                      )}
                      {identity.ssn && (
                        <div>
                          <label className="block text-xs text-gray-500">SSN</label>
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{identity.ssn}</span>
                            <button
                              onClick={() => handleCopy(identity.ssn)}
                              className="text-blue-600 text-xs hover:text-blue-800"
                            >
                              复制
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-900 mb-2">使用提示</h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>生成的身份仅用于保护隐私，请勿用于违法活动</li>
                <li>部分网站可能会验证身份信息的真实性</li>
                <li>建议配合邮箱别名功能一起使用</li>
              </ul>
            </div>
          </div>
        )}

        {/* 已保存身份 */}
        {activeTab === 'saved' && (
          <div className="bg-white rounded-lg shadow">
            {savedIdentities.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-500">暂无保存的身份</p>
                <p className="text-sm text-gray-400 mt-2">生成身份后点击"保存"即可保存</p>
              </div>
            ) : (
              <div className="divide-y">
                {savedIdentities.map(item => (
                  <div key={item.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.email} · {item.phone}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          保存于 {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setIdentity(item)}
                          className="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          查看
                        </button>
                        <button
                          onClick={() => handleDeleteIdentity(item.id)}
                          className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 邮箱别名 */}
        {activeTab === 'aliases' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">邮箱别名</h2>
                  <p className="text-sm text-gray-600">
                    创建唯一的邮箱别名，转发到您的真实邮箱，保护隐私。
                  </p>
                </div>
                <button
                  onClick={handleCreateAlias}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  创建别名
                </button>
              </div>

              {emailAliases.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📧</div>
                  <p>暂无邮箱别名</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailAliases.map(alias => (
                    <div key={alias.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-mono text-sm">{alias.alias_email}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          转发到: {alias.forward_to}
                          {alias.note && <span className="ml-2">· {alias.note}</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          创建于 {new Date(alias.created_at).toLocaleDateString()}
                          {alias.is_active ? (
                            <span className="ml-2 text-green-600">· 已启用</span>
                          ) : (
                            <span className="ml-2 text-red-600">· 已禁用</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCopy(alias.alias_email)}
                          className="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm"
                        >
                          复制
                        </button>
                        <button
                          onClick={() => handleDeleteAlias(alias.id)}
                          className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">邮箱别名用途</h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>注册网站时使用别名，避免泄露真实邮箱</li>
                <li>每个网站使用不同别名，便于追踪泄露来源</li>
                <li>随时禁用或删除别名，阻止垃圾邮件</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
