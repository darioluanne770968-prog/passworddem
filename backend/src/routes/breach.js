/**
 * 暗网监控 API
 * 监控邮箱、身份信息是否泄露
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { authMiddleware: auth } = require('../middleware/auth');
const crypto = require('crypto');

// 添加监控项
router.post('/monitors', auth, async (req, res) => {
  try {
    const { type, value } = req.body;
    const userId = req.user.id;

    if (!type || !value) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 支持的监控类型
    const validTypes = ['email', 'phone', 'username', 'domain'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: '不支持的监控类型' });
    }

    const db = getDb();

    // 检查是否已存在
    const existing = db.prepare(
      'SELECT id FROM breach_monitors WHERE user_id = ? AND monitor_type = ? AND monitor_value = ?'
    ).get(userId, type, value);

    if (existing) {
      return res.status(409).json({ error: '该监控项已存在' });
    }

    const result = db.prepare(
      'INSERT INTO breach_monitors (user_id, monitor_type, monitor_value) VALUES (?, ?, ?)'
    ).run(userId, type, value);

    // 立即执行一次检查
    const breaches = await checkBreaches(type, value);

    if (breaches.length > 0) {
      // 保存泄露警报
      const insertAlert = db.prepare(
        'INSERT INTO breach_alerts (user_id, monitor_id, breach_name, breach_date, breach_data) VALUES (?, ?, ?, ?, ?)'
      );

      for (const breach of breaches) {
        insertAlert.run(
          userId,
          result.lastInsertRowid,
          breach.Name,
          breach.BreachDate,
          JSON.stringify(breach)
        );
      }

      // 更新泄露计数
      db.prepare(
        'UPDATE breach_monitors SET breach_count = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(breaches.length, result.lastInsertRowid);
    }

    res.status(201).json({
      id: result.lastInsertRowid,
      type,
      value,
      breachCount: breaches.length,
      breaches
    });
  } catch (error) {
    console.error('添加监控失败:', error);
    res.status(500).json({ error: '添加监控失败' });
  }
});

// 获取所有监控项
router.get('/monitors', auth, (req, res) => {
  try {
    const db = getDb();
    const monitors = db.prepare(`
      SELECT m.*,
        (SELECT COUNT(*) FROM breach_alerts WHERE monitor_id = m.id AND is_read = 0) as unread_alerts
      FROM breach_monitors m
      WHERE m.user_id = ? AND m.is_active = 1
      ORDER BY m.created_at DESC
    `).all(req.user.id);

    res.json(monitors);
  } catch (error) {
    console.error('获取监控列表失败:', error);
    res.status(500).json({ error: '获取监控列表失败' });
  }
});

// 删除监控项
router.delete('/monitors/:id', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM breach_monitors WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// 获取泄露警报
router.get('/alerts', auth, (req, res) => {
  try {
    const db = getDb();
    const alerts = db.prepare(`
      SELECT a.*, m.monitor_type, m.monitor_value
      FROM breach_alerts a
      JOIN breach_monitors m ON a.monitor_id = m.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
      LIMIT 100
    `).all(req.user.id);

    res.json(alerts.map(a => ({
      ...a,
      breach_data: JSON.parse(a.breach_data || '{}')
    })));
  } catch (error) {
    res.status(500).json({ error: '获取警报失败' });
  }
});

// 标记警报已读
router.patch('/alerts/:id/read', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE breach_alerts SET is_read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新失败' });
  }
});

// 手动检查泄露
router.post('/check', auth, async (req, res) => {
  try {
    const db = getDb();
    const monitors = db.prepare(
      'SELECT * FROM breach_monitors WHERE user_id = ? AND is_active = 1'
    ).all(req.user.id);

    const results = [];

    for (const monitor of monitors) {
      const breaches = await checkBreaches(monitor.monitor_type, monitor.monitor_value);

      // 检查是否有新的泄露
      const existingBreaches = db.prepare(
        'SELECT breach_name FROM breach_alerts WHERE monitor_id = ?'
      ).all(monitor.id).map(b => b.breach_name);

      const newBreaches = breaches.filter(b => !existingBreaches.includes(b.Name));

      if (newBreaches.length > 0) {
        const insertAlert = db.prepare(
          'INSERT INTO breach_alerts (user_id, monitor_id, breach_name, breach_date, breach_data) VALUES (?, ?, ?, ?, ?)'
        );

        for (const breach of newBreaches) {
          insertAlert.run(
            req.user.id,
            monitor.id,
            breach.Name,
            breach.BreachDate,
            JSON.stringify(breach)
          );
        }
      }

      // 更新监控状态
      db.prepare(
        'UPDATE breach_monitors SET breach_count = ?, last_checked = CURRENT_TIMESTAMP WHERE id = ?'
      ).run(breaches.length, monitor.id);

      results.push({
        monitor: monitor.monitor_value,
        type: monitor.monitor_type,
        totalBreaches: breaches.length,
        newBreaches: newBreaches.length
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('检查泄露失败:', error);
    res.status(500).json({ error: '检查失败' });
  }
});

// 使用 Have I Been Pwned API 检查泄露
async function checkBreaches(type, value) {
  try {
    if (type === 'email') {
      const response = await fetch(
        `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(value)}?truncateResponse=false`,
        {
          headers: {
            'hibp-api-key': process.env.HIBP_API_KEY || '',
            'User-Agent': 'PasswordVault'
          }
        }
      );

      if (response.status === 404) {
        return []; // 未发现泄露
      }

      if (response.ok) {
        return await response.json();
      }
    }

    // 模拟数据（当没有 API Key 时）
    if (!process.env.HIBP_API_KEY) {
      return mockBreachCheck(type, value);
    }

    return [];
  } catch (error) {
    console.error('HIBP API 调用失败:', error);
    return mockBreachCheck(type, value);
  }
}

// 模拟泄露检查（演示用）
function mockBreachCheck(type, value) {
  // 使用哈希来确定是否"发现"泄露
  const hash = crypto.createHash('md5').update(value).digest('hex');
  const shouldHaveBreach = parseInt(hash.charAt(0), 16) < 4; // 25%概率

  if (shouldHaveBreach) {
    return [
      {
        Name: 'DemoBreachSite',
        Title: '演示泄露网站',
        Domain: 'demo-breach.com',
        BreachDate: '2023-06-15',
        AddedDate: '2023-07-01',
        ModifiedDate: '2023-07-01',
        PwnCount: 1500000,
        Description: '这是一个演示泄露警报。在生产环境中，这将显示真实的泄露信息。',
        DataClasses: ['Email addresses', 'Passwords', 'Usernames'],
        IsVerified: true,
        IsFabricated: false,
        IsSensitive: false,
        IsRetired: false,
        IsSpamList: false
      }
    ];
  }

  return [];
}

module.exports = router;
