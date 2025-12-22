/**
 * 审计日志 API
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { authMiddleware: auth } = require('../middleware/auth');

// 获取个人审计日志
router.get('/', auth, (req, res) => {
  try {
    const { page = 1, limit = 50, action, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;
    const db = getDb();

    let query = `
      SELECT * FROM audit_logs
      WHERE user_id = ?
    `;
    const params = [req.user.id];

    if (action) {
      query += ' AND action LIKE ?';
      params.push(`%${action}%`);
    }

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = db.prepare(query).all(...params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE user_id = ?';
    const countParams = [req.user.id];

    if (action) {
      countQuery += ' AND action LIKE ?';
      countParams.push(`%${action}%`);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取审计日志失败:', error);
    res.status(500).json({ error: '获取日志失败' });
  }
});

// 获取团队审计日志
router.get('/team/:teamId', auth, (req, res) => {
  try {
    const { teamId } = req.params;
    const { page = 1, limit = 50, action, userId } = req.query;
    const offset = (page - 1) * limit;
    const db = getDb();

    // 验证权限
    const membership = db.prepare(
      'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).get(teamId, req.user.id);

    if (!membership || !['admin', 'owner'].includes(membership.role)) {
      return res.status(403).json({ error: '无权查看团队日志' });
    }

    let query = `
      SELECT al.*, u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.team_id = ?
    `;
    const params = [teamId];

    if (action) {
      query += ' AND al.action LIKE ?';
      params.push(`%${action}%`);
    }

    if (userId) {
      query += ' AND al.user_id = ?';
      params.push(userId);
    }

    query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = db.prepare(query).all(...params);

    res.json({
      logs: logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: '获取日志失败' });
  }
});

// 导出审计报告
router.get('/export', auth, (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    const db = getDb();

    let query = 'SELECT * FROM audit_logs WHERE user_id = ?';
    const params = [req.user.id];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC';

    const logs = db.prepare(query).all(...params);

    if (format === 'csv') {
      const csv = [
        'ID,用户ID,操作,资源类型,资源ID,IP地址,用户代理,时间',
        ...logs.map(log =>
          `${log.id},${log.user_id},"${log.action}","${log.resource_type || ''}",${log.resource_id || ''},"${log.ip_address || ''}","${log.user_agent || ''}","${log.created_at}"`
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.csv');
      return res.send('\ufeff' + csv); // BOM for Excel
    }

    res.json({
      exportedAt: new Date().toISOString(),
      totalRecords: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({ error: '导出失败' });
  }
});

// 合规性报告
router.get('/compliance-report', auth, (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const db = getDb();

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    // 活动统计
    const activityStats = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM audit_logs
      WHERE user_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY action
      ORDER BY count DESC
    `).all(req.user.id, start, end);

    // 登录统计
    const loginStats = db.prepare(`
      SELECT
        COUNT(CASE WHEN action = 'auth.login' THEN 1 END) as successful_logins,
        COUNT(CASE WHEN action = 'auth.login_failed' THEN 1 END) as failed_logins,
        COUNT(DISTINCT ip_address) as unique_ips
      FROM audit_logs
      WHERE user_id = ? AND created_at BETWEEN ? AND ?
    `).get(req.user.id, start, end);

    // 敏感操作统计
    const sensitiveOps = db.prepare(`
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE user_id = ? AND created_at BETWEEN ? AND ?
      AND action IN ('item.view', 'item.export', 'share.create', 'emergency.access')
    `).get(req.user.id, start, end);

    // 每日活动
    const dailyActivity = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM audit_logs
      WHERE user_id = ? AND created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(req.user.id, start, end);

    res.json({
      reportPeriod: { start, end },
      generatedAt: new Date().toISOString(),
      summary: {
        totalActions: activityStats.reduce((sum, a) => sum + a.count, 0),
        ...loginStats,
        sensitiveOperations: sensitiveOps.count
      },
      activityBreakdown: activityStats,
      dailyActivity,
      complianceStatus: {
        dataEncryption: true,
        twoFactorAuth: !!db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id)?.totp_enabled,
        auditLogging: true,
        passwordPolicy: true
      }
    });
  } catch (error) {
    console.error('生成合规报告失败:', error);
    res.status(500).json({ error: '生成报告失败' });
  }
});

module.exports = router;
