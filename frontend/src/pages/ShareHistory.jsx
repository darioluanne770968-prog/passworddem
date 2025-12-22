import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { share } from '../utils/api';
import { useVault } from '../context/VaultContext';

/**
 * 共享历史记录页面
 * 管理已创建的共享链接
 */
export default function ShareHistory() {
  const navigate = useNavigate();
  const { items, decryptItem } = useVault();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const result = await share.getList();
      setLinks(result.links || []);
    } catch (err) {
      setError(err.message || '加载共享记录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('确定要撤销此共享链接吗？撤销后将无法访问。')) {
      return;
    }

    try {
      setRevoking(id);
      await share.revoke(id);
      setLinks(links.map(link =>
        link.id === id ? { ...link, revoked: true } : link
      ));
    } catch (err) {
      setError(err.message || '撤销失败');
    } finally {
      setRevoking(null);
    }
  };

  const handleCopy = async (token) => {
    const url = `${window.location.origin}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      alert('链接已复制');
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('链接已复制');
    }
  };

  const getItemTitle = (link) => {
    try {
      // 尝试从加密数据解析标题
      const item = items.find(i => i.encryptedData === link.itemEncryptedData);
      if (item) {
        const decrypted = decryptItem(item);
        return decrypted?.title || '未知条目';
      }
      return '未知条目';
    } catch (e) {
      return '未知条目';
    }
  };

  const getStatusBadge = (link) => {
    if (link.revoked) {
      return <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">已撤销</span>;
    }
    if (link.isExpired) {
      return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded text-xs">已过期</span>;
    }
    if (link.isExhausted) {
      return <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">次数用尽</span>;
    }
    return <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">有效</span>;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
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
        <h1 className="text-lg font-bold flex-1">共享记录</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {links.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl">🔗</span>
            <p className="text-gray-500 mt-4">暂无共享记录</p>
            <p className="text-gray-400 text-sm mt-1">在密码详情页点击"分享"创建共享链接</p>
          </div>
        ) : (
          <div className="space-y-3">
            {links.map(link => (
              <div key={link.id} className="bg-white rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🔗</span>
                      <span className="font-medium text-gray-800">
                        {getItemTitle(link)}
                      </span>
                      {getStatusBadge(link)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      创建于 {formatDate(link.createdAt)}
                    </p>
                  </div>
                </div>

                {/* 统计信息 */}
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                  <span>
                    👁 {link.viewCount}/{link.maxViews || '∞'} 次查看
                  </span>
                  <span>
                    ⏰ {link.isExpired ? '已过期' : `${formatDate(link.expiresAt)} 过期`}
                  </span>
                  {link.hasPassword && <span>🔐 密码保护</span>}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2">
                  {!link.revoked && !link.isExpired && !link.isExhausted && (
                    <>
                      <button
                        onClick={() => handleCopy(link.token)}
                        className="flex-1 py-2 bg-gray-100 text-gray-600 font-medium rounded-lg text-sm hover:bg-gray-200"
                      >
                        复制链接
                      </button>
                      <button
                        onClick={() => handleRevoke(link.id)}
                        disabled={revoking === link.id}
                        className="py-2 px-4 bg-red-50 text-red-600 font-medium rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
                      >
                        {revoking === link.id ? '撤销中...' : '撤销'}
                      </button>
                    </>
                  )}
                  {(link.revoked || link.isExpired || link.isExhausted) && (
                    <span className="flex-1 py-2 text-center text-gray-400 text-sm">
                      链接已失效
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 说明 */}
        <div className="bg-blue-50 rounded-xl p-4 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">关于共享链接</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-600">
                <li>共享链接会在过期或达到查看次数后自动失效</li>
                <li>您可以随时撤销仍然有效的链接</li>
                <li>删除密码条目会同时删除相关的共享链接</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
