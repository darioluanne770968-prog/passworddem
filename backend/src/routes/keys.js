/**
 * SSH/API 密钥管理 API
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const auth = require('../middleware/auth');
const crypto = require('crypto');

// 获取所有密钥
router.get('/', auth, (req, res) => {
  try {
    const { type } = req.query;
    const db = getDb();

    let query = `
      SELECT id, key_type, name, public_key, fingerprint, expires_at, last_used, created_at
      FROM secure_keys WHERE user_id = ?
    `;
    const params = [req.user.id];

    if (type) {
      query += ' AND key_type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC';

    const keys = db.prepare(query).all(...params);
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: '获取密钥失败' });
  }
});

// 添加密钥
router.post('/', auth, (req, res) => {
  try {
    const { type, name, encrypted_data, iv, public_key, expires_at } = req.body;
    const db = getDb();

    const validTypes = ['ssh', 'api', 'gpg', 'ssl', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: '不支持的密钥类型' });
    }

    if (!name || !encrypted_data || !iv) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 生成指纹
    let fingerprint = null;
    if (public_key) {
      fingerprint = crypto.createHash('sha256')
        .update(public_key)
        .digest('hex')
        .match(/.{2}/g)
        .join(':');
    }

    const result = db.prepare(`
      INSERT INTO secure_keys (user_id, key_type, name, encrypted_data, iv, public_key, fingerprint, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, type, name, encrypted_data, iv, public_key, fingerprint, expires_at);

    res.status(201).json({
      id: result.lastInsertRowid,
      type,
      name,
      fingerprint,
      expires_at
    });
  } catch (error) {
    console.error('添加密钥失败:', error);
    res.status(500).json({ error: '添加密钥失败' });
  }
});

// 获取单个密钥
router.get('/:id', auth, (req, res) => {
  try {
    const db = getDb();
    const key = db.prepare(`
      SELECT * FROM secure_keys WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!key) {
      return res.status(404).json({ error: '密钥不存在' });
    }

    // 更新最后使用时间
    db.prepare('UPDATE secure_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?')
      .run(req.params.id);

    res.json(key);
  } catch (error) {
    res.status(500).json({ error: '获取密钥失败' });
  }
});

// 更新密钥
router.put('/:id', auth, (req, res) => {
  try {
    const { name, encrypted_data, iv, expires_at } = req.body;
    const db = getDb();

    const existing = db.prepare(
      'SELECT id FROM secure_keys WHERE id = ? AND user_id = ?'
    ).get(req.params.id, req.user.id);

    if (!existing) {
      return res.status(404).json({ error: '密钥不存在' });
    }

    const updates = [];
    const params = [];

    if (name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (encrypted_data) {
      updates.push('encrypted_data = ?');
      params.push(encrypted_data);
    }
    if (iv) {
      updates.push('iv = ?');
      params.push(iv);
    }
    if (expires_at !== undefined) {
      updates.push('expires_at = ?');
      params.push(expires_at);
    }

    if (updates.length > 0) {
      params.push(req.params.id, req.user.id);
      db.prepare(`
        UPDATE secure_keys SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
      `).run(...params);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除密钥
router.delete('/:id', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM secure_keys WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 生成 SSH 密钥对
router.post('/generate/ssh', auth, async (req, res) => {
  try {
    const { name, type = 'ed25519', passphrase } = req.body;

    // 使用 Node.js crypto 生成密钥对
    const { generateKeyPairSync } = require('crypto');

    let keyPair;
    if (type === 'ed25519') {
      keyPair = generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
    } else {
      keyPair = generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
    }

    // 转换为 OpenSSH 格式（简化版）
    const publicKey = keyPair.publicKey;
    const privateKey = keyPair.privateKey;

    // 计算指纹
    const fingerprint = crypto.createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .match(/.{2}/g)
      .join(':');

    res.json({
      publicKey,
      privateKey,
      fingerprint,
      type,
      message: '请保存私钥，它不会再次显示'
    });
  } catch (error) {
    console.error('生成密钥失败:', error);
    res.status(500).json({ error: '生成密钥失败' });
  }
});

// 生成 API Token
router.post('/generate/api-token', auth, (req, res) => {
  try {
    const { name, expires_in_days } = req.body;

    // 生成安全的随机 token
    const prefix = 'pvt'; // password vault token
    const random = crypto.randomBytes(32).toString('base64url');
    const token = `${prefix}_${random}`;

    // 计算过期时间
    let expires_at = null;
    if (expires_in_days) {
      const date = new Date();
      date.setDate(date.getDate() + expires_in_days);
      expires_at = date.toISOString();
    }

    res.json({
      token,
      name,
      expires_at,
      message: '请保存此 token，它不会再次显示'
    });
  } catch (error) {
    res.status(500).json({ error: '生成 token 失败' });
  }
});

module.exports = router;
