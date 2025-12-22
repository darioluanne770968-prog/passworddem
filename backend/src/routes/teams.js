/**
 * 团队/家庭共享 API
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { authMiddleware: auth } = require('../middleware/auth');
const crypto = require('crypto');

// ============ 团队管理 ============

// 创建团队
router.post('/', auth, (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: '团队名称不能为空' });
    }

    const db = getDb();
    const result = db.prepare(
      'INSERT INTO teams (name, owner_id, description) VALUES (?, ?, ?)'
    ).run(name, userId, description || '');

    // 将创建者添加为管理员
    db.prepare(
      'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, userId, 'admin');

    // 记录审计日志
    logAudit(db, userId, result.lastInsertRowid, 'team.create', 'team', result.lastInsertRowid, req);

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      description,
      role: 'admin'
    });
  } catch (error) {
    console.error('创建团队失败:', error);
    res.status(500).json({ error: '创建团队失败' });
  }
});

// 获取用户的团队列表
router.get('/', auth, (req, res) => {
  try {
    const db = getDb();
    const teams = db.prepare(`
      SELECT t.*, tm.role,
        (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
        (SELECT COUNT(*) FROM shared_vaults WHERE team_id = t.id) as vault_count
      FROM teams t
      JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = ?
      ORDER BY t.created_at DESC
    `).all(req.user.id);

    res.json(teams);
  } catch (error) {
    res.status(500).json({ error: '获取团队列表失败' });
  }
});

// 获取团队详情
router.get('/:teamId', auth, (req, res) => {
  try {
    const db = getDb();
    const { teamId } = req.params;

    // 验证用户是否是团队成员
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: '无权访问此团队' });
    }

    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
    const members = db.prepare(`
      SELECT tm.*, u.email
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ?
    `).all(teamId);

    res.json({
      ...team,
      members,
      currentUserRole: membership.role
    });
  } catch (error) {
    res.status(500).json({ error: '获取团队详情失败' });
  }
});

// 邀请成员
router.post('/:teamId/invite', auth, (req, res) => {
  try {
    const { email, role = 'member' } = req.body;
    const { teamId } = req.params;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return res.status(403).json({ error: '无权邀请成员' });
    }

    // 查找用户
    const invitedUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (!invitedUser) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查是否已是成员
    const existing = db.prepare(
      'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, invitedUser.id);

    if (existing) {
      return res.status(409).json({ error: '用户已是团队成员' });
    }

    // 添加成员
    db.prepare(
      'INSERT INTO team_members (team_id, user_id, role, invited_by) VALUES (?, ?, ?, ?)'
    ).run(teamId, invitedUser.id, role, req.user.id);

    logAudit(db, req.user.id, teamId, 'team.invite', 'user', invitedUser.id, req);

    res.status(201).json({ success: true, message: '邀请成功' });
  } catch (error) {
    res.status(500).json({ error: '邀请失败' });
  }
});

// 移除成员
router.delete('/:teamId/members/:userId', auth, (req, res) => {
  try {
    const { teamId, userId } = req.params;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return res.status(403).json({ error: '无权移除成员' });
    }

    // 不能移除团队所有者
    const team = db.prepare('SELECT owner_id FROM teams WHERE id = ?').get(teamId);
    if (parseInt(userId) === team.owner_id) {
      return res.status(400).json({ error: '不能移除团队所有者' });
    }

    db.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
      .run(teamId, userId);

    logAudit(db, req.user.id, teamId, 'team.remove_member', 'user', userId, req);

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: '移除失败' });
  }
});

// ============ 共享保险箱 ============

// 创建共享保险箱
router.post('/:teamId/vaults', auth, (req, res) => {
  try {
    const { name, description } = req.body;
    const { teamId } = req.params;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership || !['admin', 'owner', 'editor'].includes(membership.role)) {
      return res.status(403).json({ error: '无权创建保险箱' });
    }

    const result = db.prepare(
      'INSERT INTO shared_vaults (team_id, name, description, created_by) VALUES (?, ?, ?, ?)'
    ).run(teamId, name, description || '', req.user.id);

    logAudit(db, req.user.id, teamId, 'vault.create', 'shared_vault', result.lastInsertRowid, req);

    res.status(201).json({
      id: result.lastInsertRowid,
      name,
      description
    });
  } catch (error) {
    res.status(500).json({ error: '创建保险箱失败' });
  }
});

// 获取团队的共享保险箱
router.get('/:teamId/vaults', auth, (req, res) => {
  try {
    const { teamId } = req.params;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: '无权访问' });
    }

    const vaults = db.prepare(`
      SELECT v.*,
        (SELECT COUNT(*) FROM shared_vault_items WHERE vault_id = v.id) as item_count
      FROM shared_vaults v
      WHERE v.team_id = ?
      ORDER BY v.created_at DESC
    `).all(teamId);

    res.json(vaults);
  } catch (error) {
    res.status(500).json({ error: '获取保险箱失败' });
  }
});

// 获取共享保险箱内容
router.get('/:teamId/vaults/:vaultId/items', auth, (req, res) => {
  try {
    const { teamId, vaultId } = req.params;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership) {
      return res.status(403).json({ error: '无权访问' });
    }

    const items = db.prepare(`
      SELECT i.*, u.email as created_by_email
      FROM shared_vault_items i
      JOIN users u ON i.created_by = u.id
      WHERE i.vault_id = ?
      ORDER BY i.created_at DESC
    `).all(vaultId);

    logAudit(db, req.user.id, teamId, 'vault.view', 'shared_vault', vaultId, req);

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: '获取条目失败' });
  }
});

// 添加条目到共享保险箱
router.post('/:teamId/vaults/:vaultId/items', auth, (req, res) => {
  try {
    const { encrypted_data, iv, category } = req.body;
    const { teamId, vaultId } = req.params;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership || membership.role === 'viewer') {
      return res.status(403).json({ error: '无权添加条目' });
    }

    const result = db.prepare(
      'INSERT INTO shared_vault_items (vault_id, encrypted_data, iv, category, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(vaultId, encrypted_data, iv, category || 'login', req.user.id);

    logAudit(db, req.user.id, teamId, 'item.create', 'shared_vault_item', result.lastInsertRowid, req);

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: '添加条目失败' });
  }
});

// ============ 辅助函数 ============

function logAudit(db, userId, teamId, action, resourceType, resourceId, req) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, team_id, action, resource_type, resource_id, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      teamId,
      action,
      resourceType,
      resourceId,
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    );
  } catch (e) {
    console.error('审计日志记录失败:', e);
  }
}

module.exports = router;
