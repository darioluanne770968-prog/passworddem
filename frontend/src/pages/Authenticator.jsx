import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Authenticator() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    issuer: '',
    secret: '',
    algorithm: 'SHA1',
    digits: 6,
    period: 30
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    loadAccounts();
    // 每秒更新一次以刷新剩余时间
    intervalRef.current = setInterval(() => {
      loadAccounts();
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await api.get('/totp/accounts');
      setAccounts(res.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/totp/accounts', newAccount);
      setNewAccount({
        name: '',
        issuer: '',
        secret: '',
        algorithm: 'SHA1',
        digits: 6,
        period: 30
      });
      setShowAddForm(false);
      setShowManualForm(false);
      await loadAccounts();
    } catch (error) {
      alert(error.response?.data?.error || '添加失败');
    }
  };

  const handleParseUri = async (uri) => {
    try {
      const res = await api.post('/totp/parse-uri', { uri });
      setNewAccount(res.data);
      setShowManualForm(true);
    } catch (error) {
      alert('无法解析该二维码');
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('确定删除此验证器？')) return;
    try {
      await api.delete(`/totp/accounts/${id}`);
      await loadAccounts();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    // 可以添加一个简短的提示
  };

  const getProgressColor = (timeRemaining, period) => {
    const percentage = (timeRemaining / period) * 100;
    if (percentage > 50) return 'bg-green-500';
    if (percentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (loading && accounts.length === 0) {
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
              <h1 className="text-xl font-bold">身份验证器</h1>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加账户
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {accounts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-6xl mb-4">🔐</div>
            <h2 className="text-xl font-semibold mb-2">暂无验证器账户</h2>
            <p className="text-gray-500 mb-6">
              添加账户以生成两步验证码
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加第一个账户
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map(account => (
              <div
                key={account.id}
                className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition"
                onClick={() => handleCopyCode(account.currentOTP)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium">{account.name}</div>
                    {account.issuer && (
                      <div className="text-sm text-gray-500">{account.issuer}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAccount(account.id);
                    }}
                    className="text-gray-400 hover:text-red-500"
                  >
                    🗑️
                  </button>
                </div>

                {/* OTP 显示 */}
                <div className="text-3xl font-mono font-bold text-center my-4 tracking-widest">
                  {account.currentOTP.match(/.{1,3}/g)?.join(' ')}
                </div>

                {/* 进度条 */}
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${getProgressColor(account.timeRemaining, account.period || 30)}`}
                    style={{ width: `${(account.timeRemaining / (account.period || 30)) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  {account.timeRemaining}秒后刷新
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">使用说明</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>点击验证码卡片即可复制到剪贴板</li>
            <li>验证码每30秒自动刷新</li>
            <li>支持扫描二维码或手动输入密钥添加账户</li>
          </ul>
        </div>
      </div>

      {/* 添加账户弹窗 */}
      {showAddForm && !showManualForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加验证器账户</h3>
            <div className="space-y-4">
              <button
                onClick={() => setShowManualForm(true)}
                className="w-full p-4 border rounded-lg text-left hover:bg-gray-50"
              >
                <div className="font-medium">手动输入密钥</div>
                <div className="text-sm text-gray-500">输入服务提供的密钥</div>
              </button>
              <button
                onClick={() => {
                  const uri = prompt('请粘贴 otpauth:// URI:');
                  if (uri) handleParseUri(uri);
                }}
                className="w-full p-4 border rounded-lg text-left hover:bg-gray-50"
              >
                <div className="font-medium">粘贴 URI</div>
                <div className="text-sm text-gray-500">粘贴 otpauth:// 格式的链接</div>
              </button>
            </div>
            <button
              onClick={() => setShowAddForm(false)}
              className="w-full mt-4 py-2 text-gray-600 hover:text-gray-800"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 手动添加表单 */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加验证器账户</h3>
            <form onSubmit={handleAddAccount} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">账户名称 *</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">服务提供商</label>
                <input
                  type="text"
                  value={newAccount.issuer}
                  onChange={(e) => setNewAccount({ ...newAccount, issuer: e.target.value })}
                  placeholder="Google, GitHub, etc."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">密钥 *</label>
                <input
                  type="text"
                  value={newAccount.secret}
                  onChange={(e) => setNewAccount({ ...newAccount, secret: e.target.value })}
                  placeholder="JBSWY3DPEHPK3PXP"
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">算法</label>
                  <select
                    value={newAccount.algorithm}
                    onChange={(e) => setNewAccount({ ...newAccount, algorithm: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="SHA1">SHA1</option>
                    <option value="SHA256">SHA256</option>
                    <option value="SHA512">SHA512</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">位数</label>
                  <select
                    value={newAccount.digits}
                    onChange={(e) => setNewAccount({ ...newAccount, digits: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value={6}>6位</option>
                    <option value={8}>8位</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">周期</label>
                  <select
                    value={newAccount.period}
                    onChange={(e) => setNewAccount({ ...newAccount, period: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value={30}>30秒</option>
                    <option value={60}>60秒</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowManualForm(false);
                    setShowAddForm(false);
                  }}
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
