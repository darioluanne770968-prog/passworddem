const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化安全笔记表
db.exec(`
  CREATE TABLE IF NOT EXISTS secure_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    is_pinned INTEGER DEFAULT 0,
    color TEXT DEFAULT '#ffffff',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 获取所有笔记
router.get('/', authenticateToken, (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT * FROM secure_notes
      WHERE user_id = ?
    `;
    const params = [req.user.userId];

    if (category && category !== 'all') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY is_pinned DESC, updated_at DESC`;

    const notes = db.prepare(query).all(...params);
    res.json(notes);
  } catch (error) {
    console.error('获取笔记失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取单个笔记
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const note = db.prepare(`
      SELECT * FROM secure_notes
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    res.json(note);
  } catch (error) {
    console.error('获取笔记失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建笔记
router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, content, category = 'general', color = '#ffffff' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: '标题和内容是必填的' });
    }

    const result = db.prepare(`
      INSERT INTO secure_notes (user_id, title, content, category, color)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.userId, title, content, category, color);

    const note = db.prepare(`SELECT * FROM secure_notes WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(note);
  } catch (error) {
    console.error('创建笔记失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 更新笔记
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { title, content, category, color, is_pinned } = req.body;

    const existing = db.prepare(`
      SELECT id FROM secure_notes WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    db.prepare(`
      UPDATE secure_notes
      SET title = COALESCE(?, title),
          content = COALESCE(?, content),
          category = COALESCE(?, category),
          color = COALESCE(?, color),
          is_pinned = COALESCE(?, is_pinned),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(title, content, category, color, is_pinned, req.params.id, req.user.userId);

    const note = db.prepare(`SELECT * FROM secure_notes WHERE id = ?`).get(req.params.id);
    res.json(note);
  } catch (error) {
    console.error('更新笔记失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 切换置顶
router.post('/:id/pin', authenticateToken, (req, res) => {
  try {
    const note = db.prepare(`
      SELECT is_pinned FROM secure_notes WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!note) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    db.prepare(`
      UPDATE secure_notes
      SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(note.is_pinned ? 0 : 1, req.params.id, req.user.userId);

    res.json({ is_pinned: !note.is_pinned });
  } catch (error) {
    console.error('切换置顶失败:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

// 删除笔记
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM secure_notes WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '笔记不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除笔记失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 获取分类列表
router.get('/categories/list', authenticateToken, (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM secure_notes
      WHERE user_id = ?
      GROUP BY category
    `).all(req.user.userId);

    res.json(categories);
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;
