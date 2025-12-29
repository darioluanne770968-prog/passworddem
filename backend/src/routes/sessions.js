const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');
const UAParser = require('ua-parser-js');

// 初始化会话表
db.exec(`
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    ip_address TEXT,
    location TEXT,
    is_current INTEGER DEFAULT 0,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 解析用户代理
function parseUserAgent(ua) {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  return {
    browser: result.browser.name || 'Unknown',
    os: result.os.name || 'Unknown',
    device_type: result.device.type || 'desktop',
    device_name: result.device.vendor ? `${result.device.vendor} ${result.device.model}` : result.os.name
  };
}

// 获取位置信息（简化版本，实际应用可接入 IP 地理位置 API）
function getLocation(ip) {
  if (ip === '127.0.0.1' || ip === '::1') {
    return '本地';
  }
  // 实际应用中可以接入 ipinfo.io 或类似服务
  return '未知';
}

// 获取所有会话
router.get('/', authenticateToken, (req, res) => {
  try {
    const sessions = db.prepare(`
      SELECT id, device_name, device_type, browser, os, ip_address, location,
             is_current, last_active, created_at
      FROM user_sessions
      WHERE user_id = ?
      ORDER BY last_active DESC
    `).all(req.user.userId);

    res.json(sessions);
  } catch (error) {
    console.error('获取会话失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 记录/更新当前会话
router.post('/current', authenticateToken, (req, res) => {
  try {
    const ua = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress;
    const tokenHash = require('crypto').createHash('sha256').update(req.token || '').digest('hex').substring(0, 32);

    const parsed = parseUserAgent(ua);
    const location = getLocation(ip);

    // 检查是否已存在该会话
    const existing = db.prepare(`
      SELECT id FROM user_sessions WHERE user_id = ? AND token_hash = ?
    `).get(req.user.userId, tokenHash);

    if (existing) {
      // 更新最后活动时间
      db.prepare(`
        UPDATE user_sessions
        SET last_active = CURRENT_TIMESTAMP, ip_address = ?, location = ?
        WHERE id = ?
      `).run(ip, location, existing.id);
    } else {
      // 创建新会话记录
      db.prepare(`
        UPDATE user_sessions SET is_current = 0 WHERE user_id = ?
      `).run(req.user.userId);

      db.prepare(`
        INSERT INTO user_sessions (user_id, token_hash, device_name, device_type, browser, os, ip_address, location, is_current)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(req.user.userId, tokenHash, parsed.device_name, parsed.device_type, parsed.browser, parsed.os, ip, location);
    }

    res.json({ message: '会话已记录' });
  } catch (error) {
    console.error('记录会话失败:', error);
    res.status(500).json({ error: '记录失败' });
  }
});

// 撤销指定会话
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const session = db.prepare(`
      SELECT is_current FROM user_sessions WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!session) {
      return res.status(404).json({ error: '会话不存在' });
    }

    if (session.is_current) {
      return res.status(400).json({ error: '无法撤销当前会话' });
    }

    db.prepare(`
      DELETE FROM user_sessions WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    res.json({ message: '会话已撤销' });
  } catch (error) {
    console.error('撤销会话失败:', error);
    res.status(500).json({ error: '撤销失败' });
  }
});

// 撤销所有其他会话
router.post('/revoke-all', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM user_sessions WHERE user_id = ? AND is_current = 0
    `).run(req.user.userId);

    res.json({ message: `已撤销 ${result.changes} 个会话` });
  } catch (error) {
    console.error('撤销所有会话失败:', error);
    res.status(500).json({ error: '撤销失败' });
  }
});

// 获取会话统计
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM user_sessions WHERE user_id = ?
    `).get(req.user.userId);

    const byDevice = db.prepare(`
      SELECT device_type, COUNT(*) as count
      FROM user_sessions
      WHERE user_id = ?
      GROUP BY device_type
    `).all(req.user.userId);

    const recent = db.prepare(`
      SELECT COUNT(*) as count
      FROM user_sessions
      WHERE user_id = ? AND last_active > datetime('now', '-24 hours')
    `).get(req.user.userId);

    res.json({
      total: total.count,
      byDevice,
      activeIn24h: recent.count
    });
  } catch (error) {
    console.error('获取会话统计失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;
