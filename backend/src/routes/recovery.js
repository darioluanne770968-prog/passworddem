const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化恢复码表
db.exec(`
  CREATE TABLE IF NOT EXISTS recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    is_used INTEGER DEFAULT 0,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS stored_recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    service_name TEXT NOT NULL,
    codes TEXT NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 生成恢复码
function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    // 生成格式: XXXX-XXXX-XXXX
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();
    codes.push(`${part1}-${part2}-${part3}`);
  }
  return codes;
}

// 哈希恢复码
function hashCode(code) {
  return crypto.createHash('sha256').update(code.toUpperCase().replace(/-/g, '')).digest('hex');
}

// 获取账户恢复码状态
router.get('/status', authenticateToken, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as remaining,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used
      FROM recovery_codes
      WHERE user_id = ?
    `).get(req.user.userId);

    res.json({
      hasRecoveryCodes: stats.total > 0,
      total: stats.total,
      remaining: stats.remaining || 0,
      used: stats.used || 0
    });
  } catch (error) {
    console.error('获取恢复码状态失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 生成新的恢复码
router.post('/generate', authenticateToken, (req, res) => {
  try {
    // 删除旧的恢复码
    db.prepare(`DELETE FROM recovery_codes WHERE user_id = ?`).run(req.user.userId);

    // 生成新的恢复码
    const codes = generateRecoveryCodes(10);

    // 存储哈希后的恢复码
    const insert = db.prepare(`
      INSERT INTO recovery_codes (user_id, code_hash)
      VALUES (?, ?)
    `);

    for (const code of codes) {
      insert.run(req.user.userId, hashCode(code));
    }

    // 返回明文恢复码（只此一次）
    res.json({
      codes,
      message: '请妥善保存这些恢复码，它们只显示一次！'
    });
  } catch (error) {
    console.error('生成恢复码失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

// 验证恢复码（用于账户恢复）
router.post('/verify', (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: '邮箱和恢复码是必填的' });
    }

    // 查找用户
    const user = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 查找未使用的恢复码
    const codeHash = hashCode(code);
    const recoveryCode = db.prepare(`
      SELECT id FROM recovery_codes
      WHERE user_id = ? AND code_hash = ? AND is_used = 0
    `).get(user.id, codeHash);

    if (!recoveryCode) {
      return res.status(400).json({ error: '恢复码无效或已使用' });
    }

    // 标记为已使用
    db.prepare(`
      UPDATE recovery_codes
      SET is_used = 1, used_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(recoveryCode.id);

    // 生成临时令牌用于重置密码
    const resetToken = crypto.randomBytes(32).toString('hex');
    // 这里应该存储 resetToken 并设置过期时间，简化处理

    res.json({
      valid: true,
      message: '恢复码验证成功',
      resetToken
    });
  } catch (error) {
    console.error('验证恢复码失败:', error);
    res.status(500).json({ error: '验证失败' });
  }
});

// ==================== 存储第三方恢复码 ====================

// 获取存储的第三方恢复码列表
router.get('/stored', authenticateToken, (req, res) => {
  try {
    const codes = db.prepare(`
      SELECT id, service_name, notes, created_at, updated_at
      FROM stored_recovery_codes
      WHERE user_id = ?
      ORDER BY service_name ASC
    `).all(req.user.userId);

    res.json(codes);
  } catch (error) {
    console.error('获取存储的恢复码失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取单个服务的恢复码
router.get('/stored/:id', authenticateToken, (req, res) => {
  try {
    const item = db.prepare(`
      SELECT * FROM stored_recovery_codes
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!item) {
      return res.status(404).json({ error: '未找到' });
    }

    // 解析存储的码
    item.codes = JSON.parse(item.codes);
    res.json(item);
  } catch (error) {
    console.error('获取恢复码失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 存储第三方恢复码
router.post('/stored', authenticateToken, (req, res) => {
  try {
    const { service_name, codes, notes } = req.body;

    if (!service_name || !codes) {
      return res.status(400).json({ error: '服务名称和恢复码是必填的' });
    }

    // codes 可以是数组或换行分隔的字符串
    let codeArray = codes;
    if (typeof codes === 'string') {
      codeArray = codes.split(/[\n,]/).map(c => c.trim()).filter(c => c);
    }

    const result = db.prepare(`
      INSERT INTO stored_recovery_codes (user_id, service_name, codes, notes)
      VALUES (?, ?, ?, ?)
    `).run(req.user.userId, service_name, JSON.stringify(codeArray), notes);

    res.status(201).json({
      id: result.lastInsertRowid,
      message: '保存成功'
    });
  } catch (error) {
    console.error('存储恢复码失败:', error);
    res.status(500).json({ error: '保存失败' });
  }
});

// 更新第三方恢复码
router.put('/stored/:id', authenticateToken, (req, res) => {
  try {
    const { service_name, codes, notes } = req.body;

    const existing = db.prepare(`
      SELECT id FROM stored_recovery_codes WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: '未找到' });
    }

    let codeArray = codes;
    if (typeof codes === 'string') {
      codeArray = codes.split(/[\n,]/).map(c => c.trim()).filter(c => c);
    }

    db.prepare(`
      UPDATE stored_recovery_codes
      SET service_name = COALESCE(?, service_name),
          codes = COALESCE(?, codes),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      service_name,
      codeArray ? JSON.stringify(codeArray) : null,
      notes,
      req.params.id,
      req.user.userId
    );

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新恢复码失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除第三方恢复码
router.delete('/stored/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM stored_recovery_codes WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '未找到' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除恢复码失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
