/**
 * 紧急访问 / 数字遗产 API
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { authMiddleware: auth } = require('../middleware/auth');
const crypto = require('crypto');

// 添加紧急联系人
router.post('/contacts', auth, (req, res) => {
  try {
    const { email, waitDays = 7, accessType = 'view' } = req.body;
    const db = getDb();

    if (!email) {
      return res.status(400).json({ error: '请提供联系人邮箱' });
    }

    // 检查是否已存在
    const existing = db.prepare(
      'SELECT id FROM emergency_access WHERE grantor_id = ? AND grantee_email = ?'
    ).get(req.user.id, email);

    if (existing) {
      return res.status(409).json({ error: '该联系人已存在' });
    }

    // 生成恢复密钥
    const recoveryKey = crypto.randomBytes(32).toString('hex');

    const result = db.prepare(`
      INSERT INTO emergency_access (grantor_id, grantee_email, wait_days, access_type, recovery_key)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, email, waitDays, accessType, recoveryKey);

    // 查找被邀请用户
    const grantee = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (grantee) {
      db.prepare('UPDATE emergency_access SET grantee_id = ? WHERE id = ?')
        .run(grantee.id, result.lastInsertRowid);
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      email,
      waitDays,
      accessType,
      status: 'pending'
    });
  } catch (error) {
    console.error('添加紧急联系人失败:', error);
    res.status(500).json({ error: '添加失败' });
  }
});

// 获取我的紧急联系人
router.get('/contacts', auth, (req, res) => {
  try {
    const db = getDb();
    const contacts = db.prepare(`
      SELECT id, grantee_email, grantee_id, status, wait_days, access_type,
             requested_at, approved_at, created_at
      FROM emergency_access
      WHERE grantor_id = ?
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取我被授权的紧急访问
router.get('/granted', auth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);

    const granted = db.prepare(`
      SELECT ea.*, u.email as grantor_email
      FROM emergency_access ea
      JOIN users u ON ea.grantor_id = u.id
      WHERE ea.grantee_email = ? OR ea.grantee_id = ?
      ORDER BY ea.created_at DESC
    `).all(user.email, req.user.id);

    res.json(granted);
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 请求紧急访问
router.post('/:id/request', auth, (req, res) => {
  try {
    const db = getDb();
    const access = db.prepare('SELECT * FROM emergency_access WHERE id = ?').get(req.params.id);

    if (!access) {
      return res.status(404).json({ error: '未找到紧急访问配置' });
    }

    // 验证是否是被授权人
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);
    if (access.grantee_email !== user.email && access.grantee_id !== req.user.id) {
      return res.status(403).json({ error: '无权请求此访问' });
    }

    if (access.status === 'approved') {
      return res.status(400).json({ error: '访问已被批准' });
    }

    if (access.status === 'requested') {
      return res.status(400).json({ error: '已有待处理的请求' });
    }

    db.prepare(`
      UPDATE emergency_access
      SET status = 'requested', requested_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.id);

    // 计算可访问时间
    const accessibleAt = new Date();
    accessibleAt.setDate(accessibleAt.getDate() + access.wait_days);

    res.json({
      success: true,
      message: `请求已提交，如果 ${access.wait_days} 天内未被拒绝，您将获得访问权限`,
      accessibleAt
    });
  } catch (error) {
    res.status(500).json({ error: '请求失败' });
  }
});

// 批准紧急访问
router.post('/:id/approve', auth, (req, res) => {
  try {
    const db = getDb();
    const access = db.prepare(
      'SELECT * FROM emergency_access WHERE id = ? AND grantor_id = ?'
    ).get(req.params.id, req.user.id);

    if (!access) {
      return res.status(404).json({ error: '未找到紧急访问配置' });
    }

    db.prepare(`
      UPDATE emergency_access
      SET status = 'approved', approved_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.params.id);

    res.json({ success: true, message: '已批准访问' });
  } catch (error) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 拒绝紧急访问请求
router.post('/:id/reject', auth, (req, res) => {
  try {
    const db = getDb();
    const access = db.prepare(
      'SELECT * FROM emergency_access WHERE id = ? AND grantor_id = ?'
    ).get(req.params.id, req.user.id);

    if (!access) {
      return res.status(404).json({ error: '未找到紧急访问配置' });
    }

    db.prepare(`
      UPDATE emergency_access SET status = 'rejected', requested_at = NULL WHERE id = ?
    `).run(req.params.id);

    res.json({ success: true, message: '已拒绝访问请求' });
  } catch (error) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 撤销紧急访问
router.delete('/:id', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM emergency_access WHERE id = ? AND grantor_id = ?')
      .run(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 使用紧急访问获取数据
router.get('/:id/access', auth, (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.user.id);

    const access = db.prepare(`
      SELECT * FROM emergency_access WHERE id = ?
    `).get(req.params.id);

    if (!access) {
      return res.status(404).json({ error: '未找到紧急访问配置' });
    }

    // 验证是否是被授权人
    if (access.grantee_email !== user.email && access.grantee_id !== req.user.id) {
      return res.status(403).json({ error: '无权访问' });
    }

    // 检查状态
    if (access.status === 'approved') {
      // 已批准，可以直接访问
    } else if (access.status === 'requested') {
      // 检查等待期是否已过
      const requestedAt = new Date(access.requested_at);
      const waitUntil = new Date(requestedAt);
      waitUntil.setDate(waitUntil.getDate() + access.wait_days);

      if (new Date() < waitUntil) {
        return res.status(403).json({
          error: '等待期尚未结束',
          accessibleAt: waitUntil
        });
      }

      // 等待期已过，自动批准
      db.prepare(`
        UPDATE emergency_access SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(req.params.id);
    } else {
      return res.status(403).json({ error: '访问未被批准' });
    }

    // 获取授权人的保险箱数据
    const items = db.prepare(`
      SELECT id, encrypted_data, iv, category, created_at, updated_at
      FROM vault_items WHERE user_id = ?
    `).all(access.grantor_id);

    res.json({
      accessType: access.access_type,
      recoveryKey: access.recovery_key,
      items
    });
  } catch (error) {
    console.error('紧急访问失败:', error);
    res.status(500).json({ error: '访问失败' });
  }
});

module.exports = router;
