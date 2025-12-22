/**
 * 订阅页面
 * 展示订阅计划并处理购买流程
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import subscription, { ProductIds, SubscriptionStatus } from '../utils/subscription';

export default function Subscription() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // 初始化订阅系统
      await subscription.initialize();

      // 并行获取产品和订阅状态
      const [productList, status] = await Promise.all([
        subscription.getProducts(),
        subscription.getSubscriptionStatus()
      ]);

      setProducts(productList);
      setCurrentStatus(status);
    } catch (err) {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(productId) {
    setError('');
    setSuccess('');
    setPurchasing(productId);

    try {
      const result = await subscription.purchase(productId);

      if (result.success) {
        setSuccess('订阅成功！感谢您的支持');
        // 刷新订阅状态
        const status = await subscription.getSubscriptionStatus();
        setCurrentStatus(status);
      } else if (result.error !== '用户取消') {
        setError(result.error || '购买失败');
      }
    } catch (err) {
      setError('购买失败，请稍后重试');
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestore() {
    setError('');
    setSuccess('');
    setRestoring(true);

    try {
      const result = await subscription.restorePurchases();

      if (result.success) {
        if (result.transactions && result.transactions.length > 0) {
          setSuccess('购买已恢复');
          // 刷新订阅状态
          const status = await subscription.getSubscriptionStatus();
          setCurrentStatus(status);
        } else {
          setError('未找到可恢复的购买');
        }
      } else {
        setError(result.error || '恢复失败');
      }
    } catch (err) {
      setError('恢复失败，请稍后重试');
    } finally {
      setRestoring(false);
    }
  }

  function getProductIcon(productId) {
    return productId === ProductIds.YEARLY ? (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ) : (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-white mt-4">加载中...</p>
        </div>
      </div>
    );
  }

  const isActive = currentStatus?.status === SubscriptionStatus.ACTIVE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      {/* 顶部导航 */}
      <header className="px-4 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">高级会员</h1>
        <div className="w-10"></div>
      </header>

      <div className="px-4 pb-8">
        {/* 当前订阅状态 */}
        {isActive && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-green-400">高级会员生效中</p>
                {currentStatus.expiresAt && (
                  <p className="text-sm text-green-300/70">
                    到期时间: {new Date(currentStatus.expiresAt).toLocaleDateString('zh-CN')}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 错误/成功提示 */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6">
            <p className="text-green-400">{success}</p>
          </div>
        )}

        {/* 会员权益 */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">高级会员权益</h2>
          <ul className="space-y-3">
            {[
              '无限密码存储',
              '跨设备同步',
              '高级密码生成器',
              '密码健康检查',
              '泄露监测',
              '安全附件存储',
              '优先客户支持',
              '无广告体验'
            ].map((benefit, index) => (
              <li key={index} className="flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-white/90">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 订阅计划 */}
        {!isActive && (
          <div className="space-y-4 mb-6">
            {products.map((product) => {
              const isYearly = product.id === ProductIds.YEARLY;
              const isPurchasing = purchasing === product.id;

              return (
                <button
                  key={product.id}
                  onClick={() => handlePurchase(product.id)}
                  disabled={purchasing}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    isYearly
                      ? 'bg-purple-500/20 border-purple-500 hover:bg-purple-500/30'
                      : 'bg-white/5 border-white/20 hover:bg-white/10'
                  } ${purchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${isYearly ? 'bg-purple-500/30 text-purple-300' : 'bg-white/10 text-white/70'}`}>
                      {getProductIcon(product.id)}
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{product.title}</h3>
                        {isYearly && (
                          <span className="px-2 py-0.5 bg-purple-500 text-xs rounded-full">
                            推荐
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/60">{product.description}</p>
                      {product.introductoryPrice && (
                        <p className="text-sm text-green-400 mt-1">
                          {product.introductoryPrice.priceString}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {isPurchasing ? (
                        <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <span className="text-lg font-bold">{product.priceString}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 恢复购买 */}
        <button
          onClick={handleRestore}
          disabled={restoring}
          className="w-full py-3 text-center text-purple-300 hover:text-purple-200 transition-colors disabled:opacity-50"
        >
          {restoring ? '恢复中...' : '恢复购买'}
        </button>

        {/* 订阅说明 */}
        <div className="mt-8 text-xs text-white/40 space-y-2">
          <p>订阅将通过您的 Apple ID 账户自动续费。</p>
          <p>当前订阅期结束前 24 小时内将自动扣费续订。</p>
          <p>您可以随时在 App Store 账户设置中管理或取消订阅。</p>
          <div className="flex justify-center gap-4 pt-2">
            <a href="/privacy" className="underline">隐私政策</a>
            <a href="/terms" className="underline">使用条款</a>
          </div>
        </div>
      </div>
    </div>
  );
}
