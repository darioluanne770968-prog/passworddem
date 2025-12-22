import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpToken, setTotpToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password, requires2FA ? totpToken : null);

      // 检查是否需要 2FA
      if (result.requiresTwoFactor) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      navigate('/vault');
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 返回重新输入密码
  const handleBack = () => {
    setRequires2FA(false);
    setTotpToken('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex flex-col">
      {/* 头部 */}
      <div className="pb-8 px-6 text-center text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}>
        <div className="text-5xl mb-4">🔐</div>
        <h1 className="text-3xl font-bold">
          {requires2FA ? '双因素认证' : '欢迎回来'}
        </h1>
        <p className="text-white/80 mt-2">
          {requires2FA ? '请输入验证器应用中的验证码' : '登录您的密码保险箱'}
        </p>
      </div>

      {/* 表单 */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          {!requires2FA ? (
            <>
              {/* 邮箱输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱地址
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="请输入邮箱"
                  required
                  autoComplete="email"
                />
              </div>

              {/* 密码输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  主密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pr-12"
                    placeholder="请输入主密码"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* 2FA 验证码输入 */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🔑</span>
                </div>
                <p className="text-gray-600 text-sm">
                  打开您的验证器应用（如 Google Authenticator），输入显示的 6 位验证码
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full text-center text-3xl font-mono tracking-[0.5em] py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="000000"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <p className="text-center text-sm text-gray-500">
                也可以使用备份码登录
              </p>

              <button
                type="button"
                onClick={handleBack}
                className="w-full py-3 text-primary-500 font-medium hover:bg-primary-50 rounded-xl"
              >
                ← 返回重新输入密码
              </button>
            </>
          )}

          <button
            type="submit"
            disabled={loading || (requires2FA && totpToken.length < 6)}
            className="w-full py-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {requires2FA ? '验证中...' : '登录中...'}
              </span>
            ) : requires2FA ? (
              '验证并登录'
            ) : (
              '登录'
            )}
          </button>
        </form>

        {!requires2FA && (
          <>
            <div className="mt-8 text-center">
              <p className="text-gray-600">
                还没有账户？{' '}
                <Link to="/register" className="text-primary-500 font-semibold">
                  立即注册
                </Link>
              </p>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
              ⚠️ 主密码无法找回，请务必牢记
            </div>
          </>
        )}
      </div>
    </div>
  );
}
