import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function KeysManagement() {
  const navigate = useNavigate();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ssh');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    type: 'ed25519',
    expires_in_days: 365
  });

  useEffect(() => {
    loadKeys();
  }, [activeTab]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/keys?type=${activeTab}`);
      setKeys(res.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      let endpoint;
      switch (activeTab) {
        case 'ssh':
          endpoint = '/keys/generate/ssh';
          break;
        case 'api':
          endpoint = '/keys/generate/api-token';
          break;
        case 'gpg':
          endpoint = '/keys/generate/gpg';
          break;
        default:
          endpoint = '/keys/generate/ssh';
      }

      const res = await api.post(endpoint, newKeyForm);
      setGeneratedKey(res.data);
      await loadKeys();
    } catch (error) {
      alert(error.response?.data?.error || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteKey = async (id) => {
    if (!confirm('确定删除此密钥？此操作不可恢复。')) return;
    try {
      await api.delete(`/keys/${id}`);
      await loadKeys();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const getKeyTypeIcon = (type) => {
    switch (type) {
      case 'ssh': return '🔐';
      case 'api': return '🔑';
      case 'gpg': return '🛡️';
      default: return '🔒';
    }
  };

  const tabs = [
    { id: 'ssh', label: 'SSH 密钥', icon: '🔐' },
    { id: 'api', label: 'API Token', icon: '🔑' },
    { id: 'gpg', label: 'GPG 密钥', icon: '🛡️' }
  ];

  if (loading && keys.length === 0) {
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
        <div className="max-w-4xl mx-auto px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">密钥管理</h1>
            </div>
            <button
              onClick={() => {
                setShowGenerateModal(true);
                setGeneratedKey(null);
                setNewKeyForm({
                  name: '',
                  type: activeTab === 'ssh' ? 'ed25519' : 'token',
                  expires_in_days: 365
                });
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              生成新密钥
            </button>
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

        {/* 密钥列表 */}
        <div className="bg-white rounded-lg shadow">
          {keys.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">{getKeyTypeIcon(activeTab)}</div>
              <p className="text-gray-500">暂无 {tabs.find(t => t.id === activeTab)?.label}</p>
              <p className="text-sm text-gray-400 mt-2">点击"生成新密钥"创建</p>
            </div>
          ) : (
            <div className="divide-y">
              {keys.map(key => (
                <div key={key.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-2xl">
                        {getKeyTypeIcon(key.key_type)}
                      </div>
                      <div>
                        <div className="font-medium">{key.name || '未命名密钥'}</div>
                        {key.fingerprint && (
                          <div className="text-sm text-gray-500 font-mono">
                            {key.fingerprint.substring(0, 32)}...
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          创建于 {new Date(key.created_at).toLocaleDateString()}
                          {key.expires_at && (
                            <span className="ml-2">
                              · 过期于 {new Date(key.expires_at).toLocaleDateString()}
                            </span>
                          )}
                          {key.last_used && (
                            <span className="ml-2">
                              · 上次使用 {new Date(key.last_used).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {key.public_key && (
                        <button
                          onClick={() => handleCopy(key.public_key)}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          复制公钥
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
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

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">
            {activeTab === 'ssh' && 'SSH 密钥用途'}
            {activeTab === 'api' && 'API Token 用途'}
            {activeTab === 'gpg' && 'GPG 密钥用途'}
          </h3>
          <p className="text-sm text-blue-800">
            {activeTab === 'ssh' && 'SSH 密钥可用于安全连接远程服务器、Git 仓库认证等。将公钥添加到目标服务器的 authorized_keys 文件中即可使用。'}
            {activeTab === 'api' && 'API Token 可用于程序化访问您的密码库，例如在 CI/CD 流程中自动获取密钥或进行自动化操作。'}
            {activeTab === 'gpg' && 'GPG 密钥可用于加密/解密文件、签名 Git 提交、验证软件包完整性等场景。'}
          </p>
        </div>
      </div>

      {/* 生成密钥弹窗 */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {generatedKey ? (
              <>
                <h3 className="text-lg font-semibold mb-4 text-green-600">密钥生成成功!</h3>
                <div className="space-y-4">
                  {generatedKey.publicKey && (
                    <div>
                      <label className="block text-sm font-medium mb-1">公钥</label>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={generatedKey.publicKey}
                          className="w-full px-3 py-2 border rounded-lg bg-gray-50 font-mono text-xs h-24"
                        />
                        <button
                          onClick={() => handleCopy(generatedKey.publicKey)}
                          className="absolute top-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded"
                        >
                          复制
                        </button>
                      </div>
                    </div>
                  )}
                  {generatedKey.privateKey && (
                    <div>
                      <label className="block text-sm font-medium mb-1">私钥 (请妥善保存!)</label>
                      <div className="relative">
                        <textarea
                          readOnly
                          value={generatedKey.privateKey}
                          className="w-full px-3 py-2 border rounded-lg bg-red-50 font-mono text-xs h-32"
                        />
                        <button
                          onClick={() => handleCopy(generatedKey.privateKey)}
                          className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded"
                        >
                          复制
                        </button>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        私钥仅显示一次，请立即保存到安全位置!
                      </p>
                    </div>
                  )}
                  {generatedKey.token && (
                    <div>
                      <label className="block text-sm font-medium mb-1">API Token</label>
                      <div className="relative">
                        <input
                          readOnly
                          value={generatedKey.token}
                          className="w-full px-3 py-2 border rounded-lg bg-yellow-50 font-mono text-sm"
                        />
                        <button
                          onClick={() => handleCopy(generatedKey.token)}
                          className="absolute top-1/2 right-2 -translate-y-1/2 px-2 py-1 bg-yellow-600 text-white text-xs rounded"
                        >
                          复制
                        </button>
                      </div>
                      <p className="text-xs text-yellow-600 mt-1">
                        Token 仅显示一次，请立即保存!
                      </p>
                    </div>
                  )}
                  {generatedKey.fingerprint && (
                    <div>
                      <label className="block text-sm font-medium mb-1">指纹</label>
                      <code className="block px-3 py-2 bg-gray-100 rounded text-xs">
                        {generatedKey.fingerprint}
                      </code>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowGenerateModal(false);
                      setGeneratedKey(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    完成
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">
                  生成 {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <form onSubmit={handleGenerate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">名称</label>
                    <input
                      type="text"
                      value={newKeyForm.name}
                      onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                      placeholder="我的密钥"
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>

                  {activeTab === 'ssh' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">密钥类型</label>
                      <select
                        value={newKeyForm.type}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, type: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value="ed25519">Ed25519 (推荐)</option>
                        <option value="rsa">RSA 4096</option>
                        <option value="ecdsa">ECDSA</option>
                      </select>
                    </div>
                  )}

                  {activeTab === 'api' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">有效期</label>
                      <select
                        value={newKeyForm.expires_in_days}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, expires_in_days: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        <option value={7}>7 天</option>
                        <option value={30}>30 天</option>
                        <option value={90}>90 天</option>
                        <option value={365}>1 年</option>
                        <option value={0}>永不过期</option>
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowGenerateModal(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={generating}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {generating ? '生成中...' : '生成'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
