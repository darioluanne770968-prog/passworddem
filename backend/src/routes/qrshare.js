const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化 QR 分享表
db.exec(`
  CREATE TABLE IF NOT EXISTS qr_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_type TEXT DEFAULT 'password',
    share_code TEXT UNIQUE NOT NULL,
    encrypted_data TEXT NOT NULL,
    pin_hash TEXT,
    expires_at DATETIME NOT NULL,
    max_views INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 生成分享码
function generateShareCode() {
  return crypto.randomBytes(16).toString('base64url');
}

// 加密数据
function encryptData(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    data: encrypted,
    tag: authTag.toString('base64')
  };
}

// 解密数据
function decryptData(encrypted, key) {
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted.data, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// 创建 QR 分享
router.post('/create', authenticateToken, (req, res) => {
  try {
    const {
      item_id,
      item_type = 'password',
      expires_minutes = 5,
      max_views = 1,
      pin
    } = req.body;

    // 获取要分享的数据
    let itemData;
    if (item_type === 'password') {
      itemData = db.prepare(`
        SELECT title, username, password, website, notes
        FROM vault_items
        WHERE id = ? AND user_id = ?
      `).get(item_id, req.user.userId);
    } else if (item_type === 'note') {
      itemData = db.prepare(`
        SELECT title, content
        FROM secure_notes
        WHERE id = ? AND user_id = ?
      `).get(item_id, req.user.userId);
    } else if (item_type === 'card') {
      itemData = db.prepare(`
        SELECT name, card_number, holder_name, expiry_month, expiry_year, cvv
        FROM bank_cards
        WHERE id = ? AND user_id = ?
      `).get(item_id, req.user.userId);
    }

    if (!itemData) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 生成加密密钥
    const encryptionKey = crypto.randomBytes(32);
    const shareCode = generateShareCode();

    // 加密数据
    const encryptedData = encryptData(itemData, encryptionKey);

    // PIN 哈希
    let pinHash = null;
    if (pin) {
      pinHash = crypto.createHash('sha256').update(pin).digest('hex');
    }

    // 计算过期时间
    const expiresAt = new Date(Date.now() + expires_minutes * 60 * 1000).toISOString();

    // 存储分享记录
    db.prepare(`
      INSERT INTO qr_shares (user_id, item_id, item_type, share_code, encrypted_data, pin_hash, expires_at, max_views)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId, item_id, item_type, shareCode,
      JSON.stringify(encryptedData), pinHash, expiresAt, max_views
    );

    // 返回分享 URL 和密钥
    const shareUrl = `/share/qr/${shareCode}`;
    const decryptionKey = encryptionKey.toString('base64url');

    res.json({
      shareUrl,
      shareCode,
      decryptionKey,
      expiresAt,
      maxViews: max_views,
      // QR 码数据（包含 URL 和密钥）
      qrData: JSON.stringify({
        url: shareUrl,
        key: decryptionKey,
        pin: !!pin
      })
    });
  } catch (error) {
    console.error('创建QR分享失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 获取分享数据（不需要认证）
router.post('/view/:code', (req, res) => {
  try {
    const { key, pin } = req.body;
    const { code } = req.params;

    const share = db.prepare(`
      SELECT * FROM qr_shares WHERE share_code = ?
    `).get(code);

    if (!share) {
      return res.status(404).json({ error: '分享不存在' });
    }

    // 检查是否过期
    if (new Date(share.expires_at) < new Date()) {
      db.prepare(`DELETE FROM qr_shares WHERE id = ?`).run(share.id);
      return res.status(410).json({ error: '分享已过期' });
    }

    // 检查查看次数
    if (share.view_count >= share.max_views) {
      db.prepare(`DELETE FROM qr_shares WHERE id = ?`).run(share.id);
      return res.status(410).json({ error: '分享已达最大查看次数' });
    }

    // 验证 PIN
    if (share.pin_hash) {
      if (!pin) {
        return res.status(401).json({ error: '需要 PIN 码', requirePin: true });
      }
      const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
      if (pinHash !== share.pin_hash) {
        return res.status(401).json({ error: 'PIN 码错误' });
      }
    }

    // 解密数据
    if (!key) {
      return res.status(400).json({ error: '缺少解密密钥' });
    }

    try {
      const encryptionKey = Buffer.from(key, 'base64url');
      const encryptedData = JSON.parse(share.encrypted_data);
      const decryptedData = decryptData(encryptedData, encryptionKey);

      // 增加查看次数
      db.prepare(`
        UPDATE qr_shares SET view_count = view_count + 1 WHERE id = ?
      `).run(share.id);

      // 如果达到最大次数，删除分享
      if (share.view_count + 1 >= share.max_views) {
        db.prepare(`DELETE FROM qr_shares WHERE id = ?`).run(share.id);
      }

      res.json({
        data: decryptedData,
        itemType: share.item_type,
        remainingViews: share.max_views - share.view_count - 1
      });
    } catch (e) {
      return res.status(400).json({ error: '解密失败，密钥可能不正确' });
    }
  } catch (error) {
    console.error('查看分享失败:', error);
    res.status(500).json({ error: '查看失败' });
  }
});

// 获取我的分享列表
router.get('/my-shares', authenticateToken, (req, res) => {
  try {
    const shares = db.prepare(`
      SELECT id, item_id, item_type, share_code, expires_at, max_views, view_count, created_at
      FROM qr_shares
      WHERE user_id = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).all(req.user.userId);

    res.json(shares);
  } catch (error) {
    console.error('获取分享列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 撤销分享
router.delete('/:code', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM qr_shares WHERE share_code = ? AND user_id = ?
    `).run(req.params.code, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '分享不存在' });
    }

    res.json({ message: '分享已撤销' });
  } catch (error) {
    console.error('撤销分享失败:', error);
    res.status(500).json({ error: '撤销失败' });
  }
});

// 清理过期分享（可以定期调用）
router.post('/cleanup', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM qr_shares WHERE expires_at < datetime('now')
    `).run();

    res.json({ message: `已清理 ${result.changes} 个过期分享` });
  } catch (error) {
    console.error('清理分享失败:', error);
    res.status(500).json({ error: '清理失败' });
  }
});

module.exports = router;
