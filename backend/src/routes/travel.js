const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化旅行模式表
db.exec(`
  CREATE TABLE IF NOT EXISTS travel_mode (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 0,
    activated_at DATETIME,
    auto_disable_at DATETIME,
    hidden_items TEXT DEFAULT '[]',
    safe_items TEXT DEFAULT '[]',
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS travel_safe_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    item_type TEXT DEFAULT 'password',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 获取旅行模式状态
router.get('/status', authenticateToken, (req, res) => {
  try {
    let status = db.prepare(`
      SELECT * FROM travel_mode WHERE user_id = ?
    `).get(req.user.userId);

    if (!status) {
      // 创建默认记录
      db.prepare(`
        INSERT INTO travel_mode (user_id) VALUES (?)
      `).run(req.user.userId);
      status = { is_active: 0, hidden_items: '[]', safe_items: '[]' };
    }

    // 检查是否需要自动禁用
    if (status.is_active && status.auto_disable_at) {
      const autoDisableTime = new Date(status.auto_disable_at);
      if (new Date() > autoDisableTime) {
        db.prepare(`
          UPDATE travel_mode SET is_active = 0, activated_at = NULL, auto_disable_at = NULL
          WHERE user_id = ?
        `).run(req.user.userId);
        status.is_active = 0;
      }
    }

    // 获取安全列表项目数
    const safeItemCount = db.prepare(`
      SELECT COUNT(*) as count FROM travel_safe_items WHERE user_id = ?
    `).get(req.user.userId);

    res.json({
      isActive: !!status.is_active,
      activatedAt: status.activated_at,
      autoDisableAt: status.auto_disable_at,
      safeItemCount: safeItemCount.count
    });
  } catch (error) {
    console.error('获取旅行模式状态失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 启用旅行模式
router.post('/activate', authenticateToken, (req, res) => {
  try {
    const { duration_hours } = req.body; // 可选的自动禁用时间

    let autoDisableAt = null;
    if (duration_hours) {
      autoDisableAt = new Date(Date.now() + duration_hours * 60 * 60 * 1000).toISOString();
    }

    db.prepare(`
      INSERT INTO travel_mode (user_id, is_active, activated_at, auto_disable_at)
      VALUES (?, 1, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        is_active = 1,
        activated_at = CURRENT_TIMESTAMP,
        auto_disable_at = ?
    `).run(req.user.userId, autoDisableAt, autoDisableAt);

    res.json({
      message: '旅行模式已启用',
      autoDisableAt
    });
  } catch (error) {
    console.error('启用旅行模式失败:', error);
    res.status(500).json({ error: '启用失败' });
  }
});

// 禁用旅行模式
router.post('/deactivate', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      UPDATE travel_mode
      SET is_active = 0, activated_at = NULL, auto_disable_at = NULL
      WHERE user_id = ?
    `).run(req.user.userId);

    res.json({ message: '旅行模式已禁用' });
  } catch (error) {
    console.error('禁用旅行模式失败:', error);
    res.status(500).json({ error: '禁用失败' });
  }
});

// 获取安全列表（旅行模式下可见的项目）
router.get('/safe-items', authenticateToken, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT tsi.*, v.title, v.website
      FROM travel_safe_items tsi
      LEFT JOIN vault_items v ON tsi.item_id = v.id AND tsi.item_type = 'password'
      WHERE tsi.user_id = ?
    `).all(req.user.userId);

    res.json(items);
  } catch (error) {
    console.error('获取安全列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加到安全列表
router.post('/safe-items', authenticateToken, (req, res) => {
  try {
    const { item_id, item_type = 'password' } = req.body;

    // 检查是否已存在
    const existing = db.prepare(`
      SELECT id FROM travel_safe_items
      WHERE user_id = ? AND item_id = ? AND item_type = ?
    `).get(req.user.userId, item_id, item_type);

    if (existing) {
      return res.status(400).json({ error: '项目已在安全列表中' });
    }

    db.prepare(`
      INSERT INTO travel_safe_items (user_id, item_id, item_type)
      VALUES (?, ?, ?)
    `).run(req.user.userId, item_id, item_type);

    res.json({ message: '已添加到安全列表' });
  } catch (error) {
    console.error('添加到安全列表失败:', error);
    res.status(500).json({ error: '添加失败' });
  }
});

// 从安全列表移除
router.delete('/safe-items/:itemId', authenticateToken, (req, res) => {
  try {
    const { item_type = 'password' } = req.query;

    const result = db.prepare(`
      DELETE FROM travel_safe_items
      WHERE user_id = ? AND item_id = ? AND item_type = ?
    `).run(req.user.userId, req.params.itemId, item_type);

    if (result.changes === 0) {
      return res.status(404).json({ error: '项目不在安全列表中' });
    }

    res.json({ message: '已从安全列表移除' });
  } catch (error) {
    console.error('从安全列表移除失败:', error);
    res.status(500).json({ error: '移除失败' });
  }
});

// 批量设置安全列表
router.post('/safe-items/batch', authenticateToken, (req, res) => {
  try {
    const { items } = req.body; // [{ item_id, item_type }]

    // 清空现有列表
    db.prepare(`DELETE FROM travel_safe_items WHERE user_id = ?`).run(req.user.userId);

    // 添加新列表
    const insert = db.prepare(`
      INSERT INTO travel_safe_items (user_id, item_id, item_type)
      VALUES (?, ?, ?)
    `);

    for (const item of items) {
      insert.run(req.user.userId, item.item_id, item.item_type || 'password');
    }

    res.json({ message: `已设置 ${items.length} 个安全项目` });
  } catch (error) {
    console.error('批量设置安全列表失败:', error);
    res.status(500).json({ error: '设置失败' });
  }
});

module.exports = router;
