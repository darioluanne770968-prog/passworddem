/**
 * 订阅管理工具类
 * 集成 iOS StoreKit 进行应用内购买
 */

import { Capacitor } from '@capacitor/core';

// 动态导入原生购买插件
let Purchases = null;

async function loadNativePlugin() {
  if (Capacitor.isNativePlatform() && !Purchases) {
    try {
      const module = await import('@capgo/native-purchases');
      Purchases = module.Purchases;
    } catch (e) {
      console.warn('原生购买插件加载失败:', e);
    }
  }
  return Purchases;
}

// 产品 ID 配置
export const ProductIds = {
  MONTHLY: 'com.passwordvault.premium.monthly',
  YEARLY: 'com.passwordvault.premium.yearly'
};

// 订阅状态
export const SubscriptionStatus = {
  NONE: 'none',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  PENDING: 'pending',
  CANCELLED: 'cancelled'
};

/**
 * 检测是否为原生平台
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * 初始化订阅系统
 * @returns {Promise<boolean>}
 */
export async function initialize() {
  if (!isNative()) {
    console.log('非原生平台，跳过订阅初始化');
    return false;
  }

  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return false;
    }

    // 注册购买更新监听器
    plugin.addListener('purchasesUpdate', handlePurchaseUpdate);
    plugin.addListener('purchasesError', handlePurchaseError);

    return true;
  } catch (error) {
    console.error('订阅系统初始化失败:', error);
    return false;
  }
}

/**
 * 获取可用产品列表
 * @returns {Promise<Array>}
 */
export async function getProducts() {
  if (!isNative()) {
    // 返回模拟产品用于开发
    return getMockProducts();
  }

  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return getMockProducts();
    }

    const { products } = await plugin.getProducts({
      productIdentifiers: Object.values(ProductIds)
    });

    return products.map(formatProduct);
  } catch (error) {
    console.error('获取产品列表失败:', error);
    return getMockProducts();
  }
}

/**
 * 购买产品
 * @param {string} productId - 产品 ID
 * @returns {Promise<{success: boolean, transaction?: object, error?: string}>}
 */
export async function purchase(productId) {
  if (!isNative()) {
    return { success: false, error: '仅支持原生平台购买' };
  }

  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return { success: false, error: '购买插件未加载' };
    }

    const result = await plugin.purchaseProduct({ productIdentifier: productId });

    if (result.transaction) {
      // 验证收据
      const verified = await verifyReceipt(result.transaction);
      return { success: verified, transaction: result.transaction };
    }

    return { success: false, error: '购买未完成' };
  } catch (error) {
    console.error('购买失败:', error);

    // 用户取消
    if (error.code === 'E_USER_CANCELLED') {
      return { success: false, error: '用户取消' };
    }

    return { success: false, error: error.message || '购买失败' };
  }
}

/**
 * 恢复购买
 * @returns {Promise<{success: boolean, transactions?: Array, error?: string}>}
 */
export async function restorePurchases() {
  if (!isNative()) {
    return { success: false, error: '仅支持原生平台' };
  }

  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return { success: false, error: '购买插件未加载' };
    }

    const result = await plugin.restorePurchases();

    if (result.transactions && result.transactions.length > 0) {
      // 验证恢复的购买
      for (const transaction of result.transactions) {
        await verifyReceipt(transaction);
      }
      return { success: true, transactions: result.transactions };
    }

    return { success: true, transactions: [] };
  } catch (error) {
    console.error('恢复购买失败:', error);
    return { success: false, error: error.message || '恢复失败' };
  }
}

/**
 * 获取当前订阅状态
 * @returns {Promise<{status: string, expiresAt?: string, productId?: string}>}
 */
export async function getSubscriptionStatus() {
  try {
    // 先检查本地缓存
    const cached = localStorage.getItem('subscription_status');
    if (cached) {
      const { status, expiresAt, productId, checkedAt } = JSON.parse(cached);
      // 缓存有效期 5 分钟
      if (Date.now() - checkedAt < 5 * 60 * 1000) {
        return { status, expiresAt, productId };
      }
    }

    // 从服务器获取状态
    const token = localStorage.getItem('token');
    if (!token) {
      return { status: SubscriptionStatus.NONE };
    }

    const response = await fetch('/api/subscription/status', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      // 缓存状态
      localStorage.setItem('subscription_status', JSON.stringify({
        ...data,
        checkedAt: Date.now()
      }));
      return data;
    }

    return { status: SubscriptionStatus.NONE };
  } catch (error) {
    console.error('获取订阅状态失败:', error);
    return { status: SubscriptionStatus.NONE };
  }
}

/**
 * 检查用户是否为高级会员
 * @returns {Promise<boolean>}
 */
export async function isPremium() {
  const { status } = await getSubscriptionStatus();
  return status === SubscriptionStatus.ACTIVE;
}

/**
 * 验证收据（发送到后端）
 * @param {object} transaction - 交易信息
 * @returns {Promise<boolean>}
 */
async function verifyReceipt(transaction) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('未登录，无法验证收据');
      return false;
    }

    const response = await fetch('/api/subscription/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        receiptData: transaction.receiptData,
        productId: transaction.productIdentifier,
        transactionId: transaction.transactionIdentifier
      })
    });

    if (response.ok) {
      const result = await response.json();
      // 更新本地缓存
      if (result.subscription) {
        localStorage.setItem('subscription_status', JSON.stringify({
          status: SubscriptionStatus.ACTIVE,
          expiresAt: result.subscription.expiresAt,
          productId: result.subscription.productId,
          checkedAt: Date.now()
        }));
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error('收据验证失败:', error);
    return false;
  }
}

/**
 * 处理购买更新事件
 */
function handlePurchaseUpdate(event) {
  console.log('购买更新:', event);
  if (event.transaction) {
    verifyReceipt(event.transaction);
  }
}

/**
 * 处理购买错误事件
 */
function handlePurchaseError(event) {
  console.error('购买错误:', event);
}

/**
 * 格式化产品信息
 */
function formatProduct(product) {
  return {
    id: product.productIdentifier,
    title: product.localizedTitle,
    description: product.localizedDescription,
    price: product.price,
    priceString: product.localizedPrice,
    currency: product.currencyCode,
    // 订阅特定信息
    subscriptionPeriod: product.subscriptionPeriod,
    introductoryPrice: product.introductoryPrice
  };
}

/**
 * 获取模拟产品（开发用）
 */
function getMockProducts() {
  return [
    {
      id: ProductIds.MONTHLY,
      title: '高级会员 - 月付',
      description: '每月自动续费，随时可取消',
      price: 12,
      priceString: '¥12.00/月',
      currency: 'CNY',
      subscriptionPeriod: 'P1M',
      introductoryPrice: null
    },
    {
      id: ProductIds.YEARLY,
      title: '高级会员 - 年付',
      description: '年付更优惠，相当于每月 ¥8.17',
      price: 98,
      priceString: '¥98.00/年',
      currency: 'CNY',
      subscriptionPeriod: 'P1Y',
      introductoryPrice: {
        price: 0,
        priceString: '免费试用 7 天',
        period: 'P7D'
      }
    }
  ];
}

// 默认导出
const subscription = {
  ProductIds,
  SubscriptionStatus,
  isNative,
  initialize,
  getProducts,
  purchase,
  restorePurchases,
  getSubscriptionStatus,
  isPremium
};

export default subscription;
