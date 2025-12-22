import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { twoFactor } from '../utils/api';

/**
 * 双因素认证设置页面
 */
export default function TwoFactorSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [step, setStep] = useState('status'); // status, setup, verify, backup, disable
  const [token, setToken] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 加载 2FA 状态
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const { enabled: is2FAEnabled } = await twoFactor.getStatus();
      setEnabled(is2FAEnabled);
      setStep(is2FAEnabled ? 'status' : 'status');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 开始设置 2FA
  const handleStartSetup = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await twoFactor.setup();
      setSetupData(data);
      setStep('setup');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 验证并启用 2FA
  const handleVerifyAndEnable = async () => {
    try {
      if (token.length !== 6) {
        setError('请输入6位验证码');
        return;
      }

      setLoading(true);
      setError('');
      const result = await twoFactor.enable(token);
      setBackupCodes(result.backupCodes);
      setStep('backup');
      setSuccess('双因素认证已启用');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 禁用 2FA
  const handleDisable = async () => {
    try {
      if (!token) {
        setError('请输入验证码或备份码');
        return;
      }

      setLoading(true);
      setError('');
      await twoFactor.disable(token);
      setEnabled(false);
      setStep('status');
      setToken('');
      setSuccess('双因素认证已禁用');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 重新生成备份码
  const handleRegenerateBackup = async () => {
    try {
      if (token.length !== 6) {
        setError('请输入6位验证码');
        return;
      }

      setLoading(true);
      setError('');
      const result = await twoFactor.regenerateBackup(token);
      setBackupCodes(result.backupCodes);
      setToken('');
      setSuccess('备份码已重新生成');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 复制备份码
  const handleCopyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      setSuccess('备份码已复制到剪贴板');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('复制失败');
    }
  };

  // 完成设置
  const handleFinish = () => {
    setEnabled(true);
    setStep('status');
    setSetupData(null);
    setBackupCodes([]);
    setToken('');
  };

  if (loading && step === 'status') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="bg-primary-500 text-white px-4 pb-4 flex items-center gap-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button onClick={() => navigate(-1)} className="text-2xl">
          ←
        </button>
        <h1 className="text-lg font-bold flex-1">双因素认证</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* 成功提示 */}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* 状态页面 */}
        {step === 'status' && (
          <>
            {/* 说明卡片 */}
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-4">
                <span className="text-3xl">🔐</span>
                <div>
                  <h3 className="font-bold text-gray-800 mb-1">什么是双因素认证？</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    双因素认证 (2FA) 通过在密码之外增加一层验证，大大提高账户安全性。
                    启用后，登录时需要输入验证器应用生成的动态验证码。
                  </p>
                </div>
              </div>
            </div>

            {/* 当前状态 */}
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">当前状态</p>
                  <p className={`text-sm ${enabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {enabled ? '已启用' : '未启用'}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  enabled ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  <span className="text-2xl">{enabled ? '✓' : '○'}</span>
                </div>
              </div>
            </div>

            {enabled ? (
              <>
                {/* 已启用状态的操作 */}
                <div className="bg-white rounded-xl divide-y">
                  <button
                    onClick={() => setStep('regenerate')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-gray-800">重新生成备份码</p>
                      <p className="text-sm text-gray-500">生成新的备份码</p>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>

                  <button
                    onClick={() => setStep('disable')}
                    className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-red-500">禁用双因素认证</p>
                      <p className="text-sm text-gray-500">停用 2FA 保护</p>
                    </div>
                    <span className="text-gray-400">›</span>
                  </button>
                </div>
              </>
            ) : (
              /* 未启用状态的操作 */
              <button
                onClick={handleStartSetup}
                disabled={loading}
                className="w-full py-4 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50"
              >
                {loading ? '加载中...' : '启用双因素认证'}
              </button>
            )}

            {/* 推荐的验证器应用 */}
            <div className="bg-white rounded-xl p-4">
              <h3 className="font-medium text-gray-800 mb-3">推荐的验证器应用</h3>
              <div className="space-y-3">
                {[
                  { name: 'Google Authenticator', desc: 'Google 官方验证器' },
                  { name: 'Microsoft Authenticator', desc: '微软官方验证器' },
                  { name: 'Authy', desc: '支持云备份的验证器' }
                ].map(app => (
                  <div key={app.name} className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      📱
                    </div>
                    <div>
                      <p className="text-gray-800">{app.name}</p>
                      <p className="text-sm text-gray-500">{app.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 设置页面 - 显示 QR 码 */}
        {step === 'setup' && setupData && (
          <>
            <div className="bg-white rounded-xl p-4 text-center">
              <h3 className="font-bold text-gray-800 mb-2">第 1 步：扫描二维码</h3>
              <p className="text-sm text-gray-500 mb-4">
                使用验证器应用扫描下方二维码
              </p>

              {/* QR 码 */}
              <div className="flex justify-center mb-4">
                <img
                  src={setupData.qrCode}
                  alt="2FA QR Code"
                  className="w-48 h-48 border rounded-lg"
                />
              </div>

              {/* 手动输入密钥 */}
              <div className="text-left bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">无法扫描？手动输入密钥：</p>
                <p className="font-mono text-sm text-gray-800 break-all select-all">
                  {setupData.secret}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4">
              <h3 className="font-bold text-gray-800 mb-2">第 2 步：输入验证码</h3>
              <p className="text-sm text-gray-500 mb-4">
                输入验证器应用显示的 6 位数字
              </p>

              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-2xl font-mono tracking-widest py-4 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                maxLength={6}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('status');
                  setSetupData(null);
                  setToken('');
                }}
                className="flex-1 py-4 bg-gray-100 text-gray-600 font-medium rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleVerifyAndEnable}
                disabled={loading || token.length !== 6}
                className="flex-1 py-4 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50"
              >
                {loading ? '验证中...' : '验证并启用'}
              </button>
            </div>
          </>
        )}

        {/* 备份码页面 */}
        {step === 'backup' && backupCodes.length > 0 && (
          <>
            <div className="bg-yellow-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-bold text-yellow-800 mb-1">请保存备份码</h3>
                  <p className="text-sm text-yellow-700">
                    这些备份码可以在无法使用验证器时登录账户。每个备份码只能使用一次。
                    请将它们保存在安全的地方。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="font-mono text-center py-2 bg-gray-50 rounded-lg text-gray-800"
                  >
                    {code}
                  </div>
                ))}
              </div>

              <button
                onClick={handleCopyBackupCodes}
                className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
              >
                📋 复制备份码
              </button>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-4 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600"
            >
              我已保存备份码
            </button>
          </>
        )}

        {/* 禁用 2FA */}
        {step === 'disable' && (
          <>
            <div className="bg-red-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-bold text-red-800 mb-1">警告</h3>
                  <p className="text-sm text-red-700">
                    禁用双因素认证会降低账户安全性。确定要继续吗？
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4">
              <p className="text-sm text-gray-600 mb-4">
                请输入验证器应用的验证码或备份码来确认禁用
              </p>

              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="验证码或备份码"
                className="w-full text-center py-3 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('status');
                  setToken('');
                  setError('');
                }}
                className="flex-1 py-4 bg-gray-100 text-gray-600 font-medium rounded-xl"
              >
                取消
              </button>
              <button
                onClick={handleDisable}
                disabled={loading || !token}
                className="flex-1 py-4 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? '处理中...' : '确认禁用'}
              </button>
            </div>
          </>
        )}

        {/* 重新生成备份码 */}
        {step === 'regenerate' && (
          <>
            {backupCodes.length > 0 ? (
              <>
                <div className="bg-green-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <h3 className="font-bold text-green-800 mb-1">新的备份码</h3>
                      <p className="text-sm text-green-700">
                        旧的备份码已失效，请保存新的备份码
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {backupCodes.map((code, index) => (
                      <div
                        key={index}
                        className="font-mono text-center py-2 bg-gray-50 rounded-lg text-gray-800"
                      >
                        {code}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleCopyBackupCodes}
                    className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
                  >
                    📋 复制备份码
                  </button>
                </div>

                <button
                  onClick={() => {
                    setStep('status');
                    setBackupCodes([]);
                    setToken('');
                  }}
                  className="w-full py-4 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600"
                >
                  完成
                </button>
              </>
            ) : (
              <>
                <div className="bg-white rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-4">
                    请输入验证器应用的验证码来生成新的备份码
                  </p>

                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-2xl font-mono tracking-widest py-4 border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    maxLength={6}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep('status');
                      setToken('');
                      setError('');
                    }}
                    className="flex-1 py-4 bg-gray-100 text-gray-600 font-medium rounded-xl"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleRegenerateBackup}
                    disabled={loading || token.length !== 6}
                    className="flex-1 py-4 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50"
                  >
                    {loading ? '生成中...' : '生成新备份码'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
