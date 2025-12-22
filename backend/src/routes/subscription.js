/**
 * 订阅管理 API
 * 处理 Apple StoreKit 收据验证和订阅状态管理
 */

const express = require('express');
const router = express.Router();
const https = require('https');
const { getDb } = require('../models/database');
const { authMiddleware: auth } = require('../middleware/auth');

// Apple 收据验证 URL
const APPLE_VERIFY_URL = {
  production: 'https://buy.itunes.apple.com/verifyReceipt',
  sandbox: 'https://sandbox.itunes.apple.com/verifyReceipt'
};

// App 专用共享密钥（需要在 App Store Connect 中获取）
const APP_SHARED_SECRET = process.env.APPLE_SHARED_SECRET || '';

// 产品 ID 映射
const PRODUCT_TYPES = {
  'com.passwordvault.premium.monthly': { type: 'monthly', days: 30 },
  'com.passwordvault.premium.yearly': { type: 'yearly', days: 365 }
};

/**
 * 获取用户订阅状态
 */
router.get('/status', auth, (req, res) => {
  try {
    const db = getDb();
    const subscription = db.prepare(`
      SELECT * FROM subscriptions
      WHERE user_id = ? AND status = 'active'
      ORDER BY expires_at DESC
      LIMIT 1
    `).get(req.user.id);

    if (subscription) {
      const expiresAt = new Date(subscription.expires_at);
      const now = new Date();

      if (expiresAt > now) {
        return res.json({
          status: 'active',
          productId: subscription.product_id,
          expiresAt: subscription.expires_at,
          autoRenew: subscription.auto_renew === 1
        });
      } else {
        // 更新过期订阅
        db.prepare('UPDATE subscriptions SET status = ? WHERE id = ?')
          .run('expired', subscription.id);
      }
    }

    res.json({ status: 'none' });
  } catch (error) {
    console.error('获取订阅状态失败:', error);
    res.status(500).json({ error: '获取订阅状态失败' });
  }
});

/**
 * 验证 Apple 收据
 */
router.post('/verify', auth, async (req, res) => {
  try {
    const { receiptData, productId, transactionId } = req.body;

    if (!receiptData) {
      return res.status(400).json({ error: '缺少收据数据' });
    }

    // 验证收据（先尝试生产环境，如果返回沙盒错误码则重试沙盒环境）
    let result = await verifyReceiptWithApple(receiptData, false);

    // 21007 表示沙盒收据发送到了生产环境
    if (result.status === 21007) {
      result = await verifyReceiptWithApple(receiptData, true);
    }

    if (result.status !== 0) {
      return res.status(400).json({
        error: '收据验证失败',
        appleStatus: result.status
      });
    }

    // 解析收据信息
    const latestReceipt = result.latest_receipt_info?.[0];
    if (!latestReceipt) {
      return res.status(400).json({ error: '无效的收据信息' });
    }

    const db = getDb();

    // 检查交易是否已处理
    const existing = db.prepare(
      'SELECT id FROM subscriptions WHERE transaction_id = ?'
    ).get(latestReceipt.transaction_id);

    if (existing) {
      return res.json({
        success: true,
        message: '交易已处理',
        subscription: getSubscriptionStatus(db, req.user.id)
      });
    }

    // 计算过期时间
    const expiresAt = new Date(parseInt(latestReceipt.expires_date_ms));

    // 检查是否在宽限期或过期
    const now = new Date();
    const status = expiresAt > now ? 'active' : 'expired';

    // 保存订阅记录
    db.prepare(`
      INSERT INTO subscriptions (
        user_id, product_id, transaction_id, original_transaction_id,
        receipt_data, expires_at, status, auto_renew, platform
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      latestReceipt.product_id,
      latestReceipt.transaction_id,
      latestReceipt.original_transaction_id,
      receiptData,
      expiresAt.toISOString(),
      status,
      result.pending_renewal_info?.[0]?.auto_renew_status === '1' ? 1 : 0,
      'ios'
    );

    res.json({
      success: true,
      subscription: {
        status,
        productId: latestReceipt.product_id,
        expiresAt: expiresAt.toISOString()
      }
    });
  } catch (error) {
    console.error('收据验证失败:', error);
    res.status(500).json({ error: '收据验证失败' });
  }
});

/**
 * Apple 服务器通知（Webhook）
 * 处理订阅状态变更
 */
router.post('/webhook/apple', express.text({ type: '*/*' }), async (req, res) => {
  try {
    // Apple 发送的是 JWT 格式的通知
    const signedPayload = req.body;

    // TODO: 验证 JWT 签名
    // 在生产环境中需要使用 Apple 的公钥验证

    // 解析 payload（这里简化处理，实际需要验证签名）
    const parts = signedPayload.split('.');
    if (parts.length !== 3) {
      return res.status(400).json({ error: '无效的通知格式' });
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const notificationType = payload.notificationType;

    console.log('Apple 通知:', notificationType);

    const db = getDb();

    switch (notificationType) {
      case 'DID_RENEW':
      case 'SUBSCRIBED':
        // 订阅续费或新订阅
        handleSubscriptionRenewal(db, payload);
        break;

      case 'EXPIRED':
      case 'DID_FAIL_TO_RENEW':
        // 订阅过期或续费失败
        handleSubscriptionExpiration(db, payload);
        break;

      case 'DID_CHANGE_RENEWAL_STATUS':
        // 自动续费状态变更
        handleRenewalStatusChange(db, payload);
        break;

      case 'REFUND':
        // 退款
        handleRefund(db, payload);
        break;
    }

    res.status(200).send();
  } catch (error) {
    console.error('处理 Apple 通知失败:', error);
    res.status(500).send();
  }
});

/**
 * 与 Apple 服务器验证收据
 */
async function verifyReceiptWithApple(receiptData, isSandbox) {
  const url = isSandbox ? APPLE_VERIFY_URL.sandbox : APPLE_VERIFY_URL.production;

  const requestBody = JSON.stringify({
    'receipt-data': receiptData,
    password: APP_SHARED_SECRET,
    'exclude-old-transactions': true
  });

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

/**
 * 获取订阅状态
 */
function getSubscriptionStatus(db, userId) {
  const subscription = db.prepare(`
    SELECT * FROM subscriptions
    WHERE user_id = ? AND status = 'active'
    ORDER BY expires_at DESC
    LIMIT 1
  `).get(userId);

  if (subscription) {
    return {
      status: 'active',
      productId: subscription.product_id,
      expiresAt: subscription.expires_at
    };
  }

  return { status: 'none' };
}

/**
 * 处理订阅续费
 */
function handleSubscriptionRenewal(db, payload) {
  const transactionInfo = payload.data?.signedTransactionInfo;
  if (!transactionInfo) return;

  // 解析交易信息
  const parts = transactionInfo.split('.');
  const transaction = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  // 查找用户
  const existing = db.prepare(
    'SELECT user_id FROM subscriptions WHERE original_transaction_id = ?'
  ).get(transaction.originalTransactionId);

  if (!existing) return;

  const expiresAt = new Date(transaction.expiresDate);

  // 更新或插入订阅记录
  db.prepare(`
    INSERT OR REPLACE INTO subscriptions (
      user_id, product_id, transaction_id, original_transaction_id,
      expires_at, status, auto_renew, platform
    ) VALUES (?, ?, ?, ?, ?, 'active', 1, 'ios')
  `).run(
    existing.user_id,
    transaction.productId,
    transaction.transactionId,
    transaction.originalTransactionId,
    expiresAt.toISOString()
  );
}

/**
 * 处理订阅过期
 */
function handleSubscriptionExpiration(db, payload) {
  const transactionInfo = payload.data?.signedTransactionInfo;
  if (!transactionInfo) return;

  const parts = transactionInfo.split('.');
  const transaction = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  db.prepare(`
    UPDATE subscriptions
    SET status = 'expired', auto_renew = 0
    WHERE original_transaction_id = ?
  `).run(transaction.originalTransactionId);
}

/**
 * 处理续费状态变更
 */
function handleRenewalStatusChange(db, payload) {
  const renewalInfo = payload.data?.signedRenewalInfo;
  if (!renewalInfo) return;

  const parts = renewalInfo.split('.');
  const renewal = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  db.prepare(`
    UPDATE subscriptions
    SET auto_renew = ?
    WHERE original_transaction_id = ?
  `).run(
    renewal.autoRenewStatus === 1 ? 1 : 0,
    renewal.originalTransactionId
  );
}

/**
 * 处理退款
 */
function handleRefund(db, payload) {
  const transactionInfo = payload.data?.signedTransactionInfo;
  if (!transactionInfo) return;

  const parts = transactionInfo.split('.');
  const transaction = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  db.prepare(`
    UPDATE subscriptions
    SET status = 'refunded'
    WHERE transaction_id = ?
  `).run(transaction.transactionId);
}

module.exports = router;
