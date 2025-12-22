import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function SecurityAdvanced() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDuressModal, setShowDuressModal] = useState(false);
  const [duressPassword, setDuressPassword] = useState('');
  const [hardwareKeys, setHardwareKeys] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsRes, keysRes] = await Promise.all([
        api.get('/security-advanced/settings'),
        api.get('/security-advanced/hardware-keys')
      ]);
      setSettings(settingsRes.data);
      setHardwareKeys(keysRes.data);
    } catch (error) {
      console.error('加载失败:', error);
      setSettings({
        duress_enabled: false,
        self_destruct_enabled: false,
        self_destruct_attempts: 10,
        geo_lock_enabled: false,
        allowed_countries: []
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/security-advanced/settings', settings);
      alert('设置已保存');
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDuressPassword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/security-advanced/duress-password', { password: duressPassword });
      setSettings({ ...settings, duress_enabled: true });
      setDuressPassword('');
      setShowDuressModal(false);
      alert('胁迫密码已设置');
    } catch (error) {
      alert(error.response?.data?.error || '设置失败');
    }
  };

  const handleDisableDuress = async () => {
    if (!confirm('确定禁用胁迫密码？')) return;
    try {
      await api.delete('/security-advanced/duress-password');
      setSettings({ ...settings, duress_enabled: false });
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleRegisterHardwareKey = async () => {
    try {
      // 开始注册流程
      const optionsRes = await api.post('/security-advanced/hardware-keys/register/begin');
      const options = optionsRes.data;

      // 调用 WebAuthn API
      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0)),
          user: {
            ...options.user,
            id: Uint8Array.from(atob(options.user.id), c => c.charCodeAt(0))
          }
        }
      });

      // 完成注册
      await api.post('/security-advanced/hardware-keys/register/complete', {
        credential: {
          id: credential.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
          response: {
            attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject))),
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON)))
          },
          type: credential.type
        }
      });

      await loadSettings();
      alert('硬件密钥注册成功');
    } catch (error) {
      console.error('注册失败:', error);
      alert('硬件密钥注册失败: ' + (error.message || '未知错误'));
    }
  };

  const handleRemoveHardwareKey = async (id) => {
    if (!confirm('确定移除此硬件密钥？')) return;
    try {
      await api.delete(`/security-advanced/hardware-keys/${id}`);
      await loadSettings();
    } catch (error) {
      alert(error.response?.data?.error || '移除失败');
    }
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
              <h1 className="text-xl font-bold">高级安全设置</h1>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 胁迫密码 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold flex items-center">
                <span className="mr-2">🚨</span>
                胁迫密码
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                在被迫登录时使用此密码，将显示伪装的空保险库或虚假数据，保护您的真实密码不被泄露。
              </p>
            </div>
            {settings.duress_enabled ? (
              <div className="flex items-center space-x-2">
                <span className="text-green-600 text-sm font-medium">已启用</span>
                <button
                  onClick={handleDisableDuress}
                  className="px-3 py-1 text-red-600 hover:text-red-800 text-sm"
                >
                  禁用
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDuressModal(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                设置胁迫密码
              </button>
            )}
          </div>
        </div>

        {/* 自毁机制 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                <span className="mr-2">💣</span>
                自毁机制
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                在连续登录失败指定次数后自动清除所有数据。
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.self_destruct_enabled}
                onChange={(e) => setSettings({ ...settings, self_destruct_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
          {settings.self_destruct_enabled && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-red-900 mb-2">
                失败次数阈值
              </label>
              <select
                value={settings.self_destruct_attempts}
                onChange={(e) => setSettings({ ...settings, self_destruct_attempts: parseInt(e.target.value) })}
                className="px-3 py-2 border border-red-300 rounded-lg"
              >
                <option value={5}>5 次</option>
                <option value={10}>10 次</option>
                <option value={15}>15 次</option>
                <option value={20}>20 次</option>
              </select>
              <p className="text-xs text-red-700 mt-2">
                警告：此功能一旦触发，所有数据将被不可逆地删除！
              </p>
            </div>
          )}
        </div>

        {/* 地理锁定 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                <span className="mr-2">🌍</span>
                地理锁定
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                仅允许从指定国家/地区登录，增加账户安全性。
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.geo_lock_enabled}
                onChange={(e) => setSettings({ ...settings, geo_lock_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          {settings.geo_lock_enabled && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                允许的国家/地区
              </label>
              <div className="flex flex-wrap gap-2">
                {['CN', 'US', 'JP', 'KR', 'GB', 'DE', 'FR', 'AU', 'CA', 'SG'].map(country => {
                  const names = {
                    CN: '中国', US: '美国', JP: '日本', KR: '韩国', GB: '英国',
                    DE: '德国', FR: '法国', AU: '澳大利亚', CA: '加拿大', SG: '新加坡'
                  };
                  const isSelected = settings.allowed_countries?.includes(country);
                  return (
                    <button
                      key={country}
                      onClick={() => {
                        const countries = settings.allowed_countries || [];
                        if (isSelected) {
                          setSettings({
                            ...settings,
                            allowed_countries: countries.filter(c => c !== country)
                          });
                        } else {
                          setSettings({
                            ...settings,
                            allowed_countries: [...countries, country]
                          });
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {names[country]}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 硬件密钥 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold flex items-center">
                <span className="mr-2">🔐</span>
                硬件安全密钥 (FIDO2/WebAuthn)
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                使用 YubiKey 或其他 FIDO2 兼容的硬件密钥进行身份验证。
              </p>
            </div>
            <button
              onClick={handleRegisterHardwareKey}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              添加硬件密钥
            </button>
          </div>

          {hardwareKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🔑</div>
              <p>暂未绑定硬件密钥</p>
            </div>
          ) : (
            <div className="space-y-2">
              {hardwareKeys.map(key => (
                <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{key.name || '硬件密钥'}</div>
                    <div className="text-sm text-gray-500">
                      添加于 {new Date(key.created_at).toLocaleDateString()}
                      {key.last_used && (
                        <span className="ml-2">· 上次使用 {new Date(key.last_used).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveHardwareKey(key.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 安全提示 */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-900 mb-2">安全提示</h3>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            <li>胁迫密码和自毁机制是最后的安全防线，请谨慎使用</li>
            <li>启用地理锁定前请确保您了解自己的常用登录位置</li>
            <li>建议注册至少两个硬件密钥作为备份</li>
            <li>所有高级安全功能的变更都会记录在审计日志中</li>
          </ul>
        </div>
      </div>

      {/* 设置胁迫密码弹窗 */}
      {showDuressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">设置胁迫密码</h3>
            <form onSubmit={handleSetDuressPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">胁迫密码</label>
                <input
                  type="password"
                  value={duressPassword}
                  onChange={(e) => setDuressPassword(e.target.value)}
                  placeholder="输入胁迫密码"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  此密码必须与您的主密码不同
                </p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  使用胁迫密码登录时，系统将显示虚假的空保险库。
                  这是为了在您被迫登录时保护您的真实数据。
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowDuressModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  确认设置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
