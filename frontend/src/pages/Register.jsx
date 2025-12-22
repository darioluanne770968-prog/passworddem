import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { evaluatePasswordStrength, getStrengthLabel, getStrengthColor } from '../utils/crypto';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = evaluatePasswordStrength(password);
  const strengthLabel = getStrengthLabel(strength);
  const strengthColor = getStrengthColor(strength);

  const canSubmit =
    email &&
    password.length >= 8 &&
    password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);

    try {
      await register(email, password);
      navigate('/vault');
    } catch (err) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex flex-col">
      {/* 头部 */}
      <div className="pb-6 px-6 text-center text-white" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
        <div className="text-5xl mb-4">🔐</div>
        <h1 className="text-3xl font-bold">创建账户</h1>
        <p className="text-white/80 mt-2">设置您的主密码</p>
      </div>

      {/* 表单 */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6 overflow-auto">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              设置主密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-12"
                placeholder="至少8位字符"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* 密码强度 */}
            {password && (
              <div className="mt-3">
                <div className="flex gap-1 mb-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex-1 h-1.5 rounded-full transition-colors"
                      style={{
                        backgroundColor: i <= strength - 1 ? strengthColor : '#e5e7eb'
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm" style={{ color: strengthColor }}>
                  密码强度：{strengthLabel}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              确认主密码
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              placeholder="再次输入密码"
              required
              autoComplete="new-password"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-red-500 mt-1">两次密码不一致</p>
            )}
            {confirmPassword && password === confirmPassword && password.length >= 8 && (
              <p className="text-sm text-green-500 mt-1">✓ 密码匹配</p>
            )}
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
            <p className="font-semibold mb-2">⚠️ 重要提示</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>主密码无法找回，请务必牢记</li>
              <li>建议使用大小写字母、数字和符号组合</li>
              <li>不要使用生日、电话等容易猜测的密码</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full py-4 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full loading"></span>
                创建中...
              </span>
            ) : (
              '创建保险箱'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            已有账户？{' '}
            <Link to="/login" className="text-primary-500 font-semibold">
              立即登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
