const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化 TOTP 表
db.exec(`
  CREATE TABLE IF NOT EXISTS totp_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    issuer TEXT,
    secret TEXT NOT NULL,
    algorithm TEXT DEFAULT 'SHA1',
    digits INTEGER DEFAULT 6,
    period INTEGER DEFAULT 30,
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Base32 编码/解码
const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(str) {
  str = str.toUpperCase().replace(/=+$/, '');
  let bits = '';
  for (let char of str) {
    const val = base32Chars.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

function base32Encode(buffer) {
  let bits = '';
  for (let byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.substr(i, 5).padEnd(5, '0');
    result += base32Chars[parseInt(chunk, 2)];
  }
  return result;
}

// 生成 TOTP
function generateTOTP(secret, algorithm = 'SHA1', digits = 6, period = 30, timestamp = null) {
  const time = timestamp || Math.floor(Date.now() / 1000);
  const counter = Math.floor(time / period);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const key = base32Decode(secret);
  const hmac = crypto.createHmac(algorithm.toLowerCase().replace('-', ''), key);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

// 计算剩余时间
function getTimeRemaining(period = 30) {
  const now = Math.floor(Date.now() / 1000);
  return period - (now % period);
}

// 获取所有 TOTP 账户
router.get('/accounts', authenticateToken, (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT id, name, issuer, secret, algorithm, digits, period, icon, created_at
      FROM totp_accounts
      WHERE user_id = ?
      ORDER BY name ASC
    `).all(req.user.userId);

    // 为每个账户生成当前 OTP
    const accountsWithOTP = accounts.map(account => {
      const currentOTP = generateTOTP(
        account.secret,
        account.algorithm,
        account.digits,
        account.period
      );
      const timeRemaining = getTimeRemaining(account.period);

      return {
        ...account,
        secret: undefined, // 不返回密钥
        currentOTP,
        timeRemaining
      };
    });

    res.json(accountsWithOTP);
  } catch (error) {
    console.error('获取TOTP账户失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取单个账户的当前 OTP
router.get('/accounts/:id/code', authenticateToken, (req, res) => {
  try {
    const account = db.prepare(`
      SELECT secret, algorithm, digits, period
      FROM totp_accounts
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!account) {
      return res.status(404).json({ error: '账户不存在' });
    }

    const currentOTP = generateTOTP(
      account.secret,
      account.algorithm,
      account.digits,
      account.period
    );
    const timeRemaining = getTimeRemaining(account.period);

    res.json({ code: currentOTP, timeRemaining });
  } catch (error) {
    console.error('获取OTP失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加 TOTP 账户
router.post('/accounts', authenticateToken, (req, res) => {
  try {
    const { name, issuer, secret, algorithm = 'SHA1', digits = 6, period = 30, icon } = req.body;

    if (!name || !secret) {
      return res.status(400).json({ error: '名称和密钥是必填的' });
    }

    // 验证密钥格式
    try {
      base32Decode(secret);
    } catch (e) {
      return res.status(400).json({ error: '密钥格式无效' });
    }

    const result = db.prepare(`
      INSERT INTO totp_accounts (user_id, name, issuer, secret, algorithm, digits, period, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.userId, name, issuer, secret.toUpperCase().replace(/\s/g, ''), algorithm, digits, period, icon);

    res.json({
      id: result.lastInsertRowid,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加TOTP账户失败:', error);
    res.status(500).json({ error: '添加失败' });
  }
});

// 解析 otpauth URI
router.post('/parse-uri', authenticateToken, (req, res) => {
  try {
    const { uri } = req.body;

    if (!uri || !uri.startsWith('otpauth://totp/')) {
      return res.status(400).json({ error: '无效的 otpauth URI' });
    }

    const url = new URL(uri);
    const params = url.searchParams;
    const path = decodeURIComponent(url.pathname.substring(1)); // Remove leading /

    let name = path;
    let issuer = params.get('issuer') || '';

    // 如果路径包含 issuer:name 格式
    if (path.includes(':')) {
      const parts = path.split(':');
      if (!issuer) issuer = parts[0];
      name = parts.slice(1).join(':');
    }

    res.json({
      name,
      issuer,
      secret: params.get('secret') || '',
      algorithm: params.get('algorithm') || 'SHA1',
      digits: parseInt(params.get('digits')) || 6,
      period: parseInt(params.get('period')) || 30
    });
  } catch (error) {
    console.error('解析URI失败:', error);
    res.status(400).json({ error: '解析失败' });
  }
});

// 生成新的 TOTP 密钥
router.post('/generate-secret', authenticateToken, (req, res) => {
  try {
    const secret = base32Encode(crypto.randomBytes(20));
    res.json({ secret });
  } catch (error) {
    console.error('生成密钥失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

// 更新 TOTP 账户
router.put('/accounts/:id', authenticateToken, (req, res) => {
  try {
    const { name, issuer, icon } = req.body;

    const existing = db.prepare(`
      SELECT id FROM totp_accounts WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: '账户不存在' });
    }

    db.prepare(`
      UPDATE totp_accounts
      SET name = COALESCE(?, name),
          issuer = COALESCE(?, issuer),
          icon = COALESCE(?, icon)
      WHERE id = ? AND user_id = ?
    `).run(name, issuer, icon, req.params.id, req.user.userId);

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新TOTP账户失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除 TOTP 账户
router.delete('/accounts/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM totp_accounts WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '账户不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除TOTP账户失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 导出账户（备份）
router.get('/export', authenticateToken, (req, res) => {
  try {
    const accounts = db.prepare(`
      SELECT name, issuer, secret, algorithm, digits, period
      FROM totp_accounts
      WHERE user_id = ?
    `).all(req.user.userId);

    res.json({ accounts, exportedAt: new Date().toISOString() });
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

// 导入账户
router.post('/import', authenticateToken, (req, res) => {
  try {
    const { accounts } = req.body;

    if (!Array.isArray(accounts)) {
      return res.status(400).json({ error: '无效的导入数据' });
    }

    let imported = 0;
    for (const account of accounts) {
      if (!account.name || !account.secret) continue;

      db.prepare(`
        INSERT INTO totp_accounts (user_id, name, issuer, secret, algorithm, digits, period)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.userId,
        account.name,
        account.issuer || '',
        account.secret,
        account.algorithm || 'SHA1',
        account.digits || 6,
        account.period || 30
      );
      imported++;
    }

    res.json({ message: `成功导入 ${imported} 个账户` });
  } catch (error) {
    console.error('导入失败:', error);
    res.status(500).json({ error: '导入失败' });
  }
});

module.exports = router;
