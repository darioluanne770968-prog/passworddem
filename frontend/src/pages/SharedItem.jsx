import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { share } from '../utils/api';

/**
 * 共享条目查看页面
 * 公开访问，无需登录
 */
export default function SharedItem() {
  const { token } = useParams();
  const [status, setStatus] = useState('loading'); // loading, password, success, error
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [decryptedData, setDecryptedData] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // 检查链接状态
  useEffect(() => {
    checkLink();
  }, [token]);

  const checkLink = async () => {
    try {
      const result = await share.check(token);

      if (!result.valid) {
        if (result.isExpired) {
          setError('链接已过期');
        } else if (result.isRevoked) {
          setError('链接已被撤销');
        } else if (result.isExhausted) {
          setError('链接查看次数已用尽');
        } else {
          setError('链接无效');
        }
        setStatus('error');
        return;
      }

      if (result.requiresPassword) {
        setStatus('password');
      } else {
        // 无密码保护，直接获取数据
        await accessLink();
      }
    } catch (err) {
      setError(err.message || '链接无效或已失效');
      setStatus('error');
    }
  };

  const accessLink = async (pwd = null) => {
    try {
      setLoading(true);
      const result = await share.access(token, pwd);
      setData(result);

      // 尝试解析加密数据（这里只是base64解码，实际解密需要密钥）
      // 共享的数据是用共享密钥重新加密的，可以解密
      try {
        const decoded = atob(result.encryptedData);
        const parsed = JSON.parse(decoded);
        setDecryptedData(parsed);
      } catch (e) {
        // 如果解析失败，显示原始加密数据
        setDecryptedData(null);
      }

      setStatus('success');
    } catch (err) {
      if (err.message === '需要密码' || err.requiresPassword) {
        setStatus('password');
      } else {
        setError(err.message || '访问链接失败');
        setStatus('error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    await accessLink(password);
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 加载中
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
        <p className="text-white/80 mt-4">正在加载...</p>
      </div>
    );
  }

  // 错误状态
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex flex-col items-center justify-center px-6">
        <div className="text-center text-white">
          <span className="text-7xl">🔒</span>
          <h1 className="text-2xl font-bold mt-4">{error}</h1>
          <p className="text-white/70 mt-2">该共享链接不可用</p>
        </div>
        <Link
          to="/welcome"
          className="mt-8 px-6 py-3 bg-white text-primary-600 font-medium rounded-xl hover:bg-gray-100"
        >
          返回首页
        </Link>
      </div>
    );
  }

  // 需要密码
  if (status === 'password') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex flex-col items-center justify-center px-6">
        <div className="text-center text-white mb-8">
          <span className="text-7xl">🔐</span>
          <h1 className="text-2xl font-bold mt-4">需要访问密码</h1>
          <p className="text-white/70 mt-2">该链接受密码保护</p>
        </div>

        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-400/50 text-white rounded-xl text-center text-sm">
              {error}
            </div>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入访问密码"
            className="w-full px-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
            required
            autoFocus
          />

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-4 py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 disabled:opacity-50"
          >
            {loading ? '验证中...' : '访问'}
          </button>
        </form>
      </div>
    );
  }

  // 成功显示数据
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="bg-primary-500 text-white px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <div className="flex items-center gap-4">
          <span className="text-2xl">🔗</span>
          <div className="flex-1">
            <h1 className="text-lg font-bold">共享的密码</h1>
            <p className="text-white/70 text-sm">
              {data?.maxViews && `已查看 ${data.viewCount}/${data.maxViews} 次`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 内容卡片 */}
        <div className="bg-white rounded-xl p-4 space-y-4">
          {decryptedData ? (
            <>
              {/* 标题 */}
              {decryptedData.title && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">标题</p>
                  <p className="font-medium text-gray-800">{decryptedData.title}</p>
                </div>
              )}

              {/* 用户名 */}
              {decryptedData.username && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">用户名</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-mono text-gray-800">{decryptedData.username}</p>
                    <button
                      onClick={() => handleCopy(decryptedData.username)}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                    >
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                </div>
              )}

              {/* 密码 */}
              {decryptedData.password && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">密码</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-mono text-gray-800">
                      {showPassword ? decryptedData.password : '••••••••'}
                    </p>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
                    >
                      {showPassword ? '隐藏' : '显示'}
                    </button>
                    <button
                      onClick={() => handleCopy(decryptedData.password)}
                      className="px-3 py-1 bg-primary-500 text-white rounded-lg text-sm hover:bg-primary-600"
                    >
                      复制
                    </button>
                  </div>
                </div>
              )}

              {/* 网址 */}
              {decryptedData.url && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">网址</p>
                  <a
                    href={decryptedData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-500 hover:underline break-all"
                  >
                    {decryptedData.url}
                  </a>
                </div>
              )}

              {/* 备注 */}
              {decryptedData.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">备注</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{decryptedData.notes}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <span className="text-4xl">🔒</span>
              <p className="text-gray-500 mt-2">数据已加密</p>
              <p className="text-gray-400 text-sm mt-1">需要正确的解密密钥才能查看</p>
            </div>
          )}
        </div>

        {/* 过期提示 */}
        <div className="bg-yellow-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⏰</span>
            <div className="text-sm">
              <p className="font-medium text-yellow-800">链接信息</p>
              <p className="text-yellow-600 mt-1">
                过期时间：{new Date(data?.expiresAt).toLocaleString('zh-CN')}
              </p>
              {data?.maxViews && (
                <p className="text-yellow-600">
                  剩余查看次数：{data.maxViews - data.viewCount} 次
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 安全提示 */}
        <div className="bg-blue-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">安全提示</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>请在安全的环境下查看密码</li>
                <li>不要将密码保存在不安全的位置</li>
                <li>使用后建议立即关闭页面</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 底部链接 */}
      <div className="p-4 border-t bg-white">
        <Link
          to="/welcome"
          className="block w-full py-3 text-center text-primary-500 font-medium"
        >
          了解密码保险箱
        </Link>
      </div>
    </div>
  );
}
