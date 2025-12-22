/**
 * 高级安全功能 API
 * 胁迫密码、自毁机制、地理锁定、硬件密钥
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ============ 安全设置 ============

// 获取安全设置
router.get('/settings', auth, (req, res) => {
  try {
    const db = getDb();
    let settings = db.prepare(
      'SELECT * FROM security_settings WHERE user_id = ?'
    ).get(req.user.id);

    if (!settings) {
      // 创建默认设置
      db.prepare(`
        INSERT INTO security_settings (user_id) VALUES (?)
      `).run(req.user.id);
      settings = {
        duress_password_hash: null,
        self_destruct_attempts: 10,
        geo_lock_enabled: 0,
        allowed_countries: null,
        require_hardware_key: 0
      };
    }

    res.json({
      hasDuressPassword: !!settings.duress_password_hash,
      selfDestructAttempts: settings.self_destruct_attempts,
      geoLockEnabled: !!settings.geo_lock_enabled,
      allowedCountries: settings.allowed_countries ? JSON.parse(settings.allowed_countries) : [],
      requireHardwareKey: !!settings.require_hardware_key
    });
  } catch (error) {
    res.status(500).json({ error: '获取设置失败' });
  }
});

// 设置胁迫密码
router.post('/duress-password', auth, async (req, res) => {
  try {
    const { password } = req.body;
    const db = getDb();

    if (!password || password.length < 8) {
      return res.status(400).json({ error: '胁迫密码至少需要8位' });
    }

    const hash = await bcrypt.hash(password, 12);

    db.prepare(`
      INSERT INTO security_settings (user_id, duress_password_hash)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET duress_password_hash = ?, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, hash, hash);

    res.json({ success: true, message: '胁迫密码已设置' });
  } catch (error) {
    res.status(500).json({ error: '设置失败' });
  }
});

// 删除胁迫密码
router.delete('/duress-password', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare(`
      UPDATE security_settings SET duress_password_hash = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 设置自毁尝试次数
router.patch('/self-destruct', auth, (req, res) => {
  try {
    const { attempts } = req.body;
    const db = getDb();

    if (attempts < 3 || attempts > 50) {
      return res.status(400).json({ error: '尝试次数必须在3-50之间' });
    }

    db.prepare(`
      INSERT INTO security_settings (user_id, self_destruct_attempts)
      VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET self_destruct_attempts = ?, updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, attempts, attempts);

    res.json({ success: true, attempts });
  } catch (error) {
    res.status(500).json({ error: '设置失败' });
  }
});

// 设置地理锁定
router.patch('/geo-lock', auth, (req, res) => {
  try {
    const { enabled, countries } = req.body;
    const db = getDb();

    const countriesJson = countries ? JSON.stringify(countries) : null;

    db.prepare(`
      INSERT INTO security_settings (user_id, geo_lock_enabled, allowed_countries)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        geo_lock_enabled = ?,
        allowed_countries = ?,
        updated_at = CURRENT_TIMESTAMP
    `).run(req.user.id, enabled ? 1 : 0, countriesJson, enabled ? 1 : 0, countriesJson);

    res.json({ success: true, enabled, countries });
  } catch (error) {
    res.status(500).json({ error: '设置失败' });
  }
});

// ============ 硬件密钥 (FIDO2/WebAuthn) ============

// 开始注册硬件密钥
router.post('/hardware-key/register/begin', auth, async (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

    // 获取已注册的密钥
    const existingKeys = db.prepare(
      'SELECT credential_id FROM hardware_keys WHERE user_id = ?'
    ).all(req.user.id);

    const challenge = crypto.randomBytes(32);

    // 存储 challenge（临时）
    const challengeStore = global.challengeStore || new Map();
    challengeStore.set(req.user.id, {
      challenge: challenge.toString('base64'),
      timestamp: Date.now()
    });
    global.challengeStore = challengeStore;

    const options = {
      challenge: challenge.toString('base64'),
      rp: {
        name: '密码保险箱',
        id: process.env.RP_ID || 'localhost'
      },
      user: {
        id: Buffer.from(String(req.user.id)).toString('base64'),
        name: user.email,
        displayName: user.email.split('@')[0]
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },   // ES256
        { alg: -257, type: 'public-key' }  // RS256
      ],
      timeout: 60000,
      attestation: 'direct',
      excludeCredentials: existingKeys.map(k => ({
        id: k.credential_id,
        type: 'public-key',
        transports: ['usb', 'ble', 'nfc', 'internal']
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform',
        userVerification: 'preferred',
        residentKey: 'preferred'
      }
    };

    res.json(options);
  } catch (error) {
    console.error('开始注册失败:', error);
    res.status(500).json({ error: '开始注册失败' });
  }
});

// 完成注册硬件密钥
router.post('/hardware-key/register/complete', auth, async (req, res) => {
  try {
    const { credential, name } = req.body;
    const db = getDb();

    // 验证 challenge
    const challengeStore = global.challengeStore || new Map();
    const stored = challengeStore.get(req.user.id);

    if (!stored || Date.now() - stored.timestamp > 60000) {
      return res.status(400).json({ error: '注册超时，请重试' });
    }

    challengeStore.delete(req.user.id);

    // 保存密钥
    const result = db.prepare(`
      INSERT INTO hardware_keys (user_id, credential_id, public_key, name, transports)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      credential.id,
      credential.publicKey,
      name || '硬件密钥',
      JSON.stringify(credential.transports || [])
    );

    res.json({
      success: true,
      id: result.lastInsertRowid,
      name: name || '硬件密钥'
    });
  } catch (error) {
    console.error('完成注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 获取已注册的硬件密钥
router.get('/hardware-keys', auth, (req, res) => {
  try {
    const db = getDb();
    const keys = db.prepare(`
      SELECT id, name, created_at, last_used
      FROM hardware_keys WHERE user_id = ?
    `).all(req.user.id);

    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 删除硬件密钥
router.delete('/hardware-keys/:id', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM hardware_keys WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// ============ 密码历史 ============

// 获取密码历史
router.get('/password-history/:itemId', auth, (req, res) => {
  try {
    const db = getDb();

    // 验证条目所有权
    const item = db.prepare(
      'SELECT id FROM vault_items WHERE id = ? AND user_id = ?'
    ).get(req.params.itemId, req.user.id);

    if (!item) {
      return res.status(404).json({ error: '条目不存在' });
    }

    const history = db.prepare(`
      SELECT id, encrypted_data, iv, changed_at
      FROM password_history
      WHERE item_id = ?
      ORDER BY changed_at DESC
      LIMIT 10
    `).all(req.params.itemId);

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: '获取历史失败' });
  }
});

module.exports = router;
