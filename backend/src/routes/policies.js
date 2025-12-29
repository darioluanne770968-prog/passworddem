const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化密码策略表
db.exec(`
  CREATE TABLE IF NOT EXISTS password_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    domain_pattern TEXT,
    min_length INTEGER DEFAULT 12,
    max_length INTEGER DEFAULT 64,
    require_uppercase INTEGER DEFAULT 1,
    require_lowercase INTEGER DEFAULT 1,
    require_numbers INTEGER DEFAULT 1,
    require_symbols INTEGER DEFAULT 1,
    excluded_chars TEXT DEFAULT '',
    required_chars TEXT DEFAULT '',
    expires_days INTEGER DEFAULT 0,
    history_count INTEGER DEFAULT 0,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 预定义策略模板
const policyTemplates = {
  'banking': {
    name: '银行/金融',
    min_length: 16,
    max_length: 32,
    require_uppercase: 1,
    require_lowercase: 1,
    require_numbers: 1,
    require_symbols: 1,
    excluded_chars: 'lI1O0',
    expires_days: 90,
    history_count: 5
  },
  'social': {
    name: '社交媒体',
    min_length: 12,
    max_length: 64,
    require_uppercase: 1,
    require_lowercase: 1,
    require_numbers: 1,
    require_symbols: 0,
    expires_days: 180
  },
  'email': {
    name: '电子邮箱',
    min_length: 14,
    max_length: 64,
    require_uppercase: 1,
    require_lowercase: 1,
    require_numbers: 1,
    require_symbols: 1,
    expires_days: 90,
    history_count: 3
  },
  'gaming': {
    name: '游戏平台',
    min_length: 10,
    max_length: 32,
    require_uppercase: 1,
    require_lowercase: 1,
    require_numbers: 1,
    require_symbols: 0
  },
  'work': {
    name: '企业/工作',
    min_length: 14,
    max_length: 64,
    require_uppercase: 1,
    require_lowercase: 1,
    require_numbers: 1,
    require_symbols: 1,
    expires_days: 60,
    history_count: 10
  },
  'maximum': {
    name: '最高安全',
    min_length: 20,
    max_length: 128,
    require_uppercase: 1,
    require_lowercase: 1,
    require_numbers: 1,
    require_symbols: 1,
    excluded_chars: 'lI1O0',
    expires_days: 30,
    history_count: 24
  }
};

// 获取策略模板
router.get('/templates', authenticateToken, (req, res) => {
  res.json(policyTemplates);
});

// 获取所有自定义策略
router.get('/', authenticateToken, (req, res) => {
  try {
    const policies = db.prepare(`
      SELECT * FROM password_policies
      WHERE user_id = ?
      ORDER BY is_default DESC, name ASC
    `).all(req.user.userId);

    res.json(policies);
  } catch (error) {
    console.error('获取密码策略失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取单个策略
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const policy = db.prepare(`
      SELECT * FROM password_policies
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!policy) {
      return res.status(404).json({ error: '策略不存在' });
    }

    res.json(policy);
  } catch (error) {
    console.error('获取策略失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 根据域名匹配策略
router.get('/match/:domain', authenticateToken, (req, res) => {
  try {
    const domain = req.params.domain.toLowerCase();

    // 查找匹配的策略
    const policies = db.prepare(`
      SELECT * FROM password_policies
      WHERE user_id = ? AND domain_pattern IS NOT NULL
      ORDER BY LENGTH(domain_pattern) DESC
    `).all(req.user.userId);

    for (const policy of policies) {
      const pattern = policy.domain_pattern.toLowerCase();
      // 简单的域名匹配，支持通配符 *
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(domain)) {
        return res.json(policy);
      }
    }

    // 返回默认策略
    const defaultPolicy = db.prepare(`
      SELECT * FROM password_policies
      WHERE user_id = ? AND is_default = 1
    `).get(req.user.userId);

    if (defaultPolicy) {
      return res.json(defaultPolicy);
    }

    // 返回系统默认
    res.json({
      min_length: 12,
      max_length: 64,
      require_uppercase: 1,
      require_lowercase: 1,
      require_numbers: 1,
      require_symbols: 1
    });
  } catch (error) {
    console.error('匹配策略失败:', error);
    res.status(500).json({ error: '匹配失败' });
  }
});

// 创建策略
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      name,
      domain_pattern,
      min_length = 12,
      max_length = 64,
      require_uppercase = 1,
      require_lowercase = 1,
      require_numbers = 1,
      require_symbols = 1,
      excluded_chars = '',
      required_chars = '',
      expires_days = 0,
      history_count = 0,
      is_default = 0
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: '策略名称是必填的' });
    }

    // 如果设为默认，取消其他默认
    if (is_default) {
      db.prepare(`
        UPDATE password_policies SET is_default = 0 WHERE user_id = ?
      `).run(req.user.userId);
    }

    const result = db.prepare(`
      INSERT INTO password_policies (
        user_id, name, domain_pattern, min_length, max_length,
        require_uppercase, require_lowercase, require_numbers, require_symbols,
        excluded_chars, required_chars, expires_days, history_count, is_default
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId, name, domain_pattern, min_length, max_length,
      require_uppercase, require_lowercase, require_numbers, require_symbols,
      excluded_chars, required_chars, expires_days, history_count, is_default
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: '策略创建成功'
    });
  } catch (error) {
    console.error('创建策略失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 从模板创建策略
router.post('/from-template', authenticateToken, (req, res) => {
  try {
    const { template_id, domain_pattern } = req.body;

    const template = policyTemplates[template_id];
    if (!template) {
      return res.status(400).json({ error: '模板不存在' });
    }

    const result = db.prepare(`
      INSERT INTO password_policies (
        user_id, name, domain_pattern, min_length, max_length,
        require_uppercase, require_lowercase, require_numbers, require_symbols,
        excluded_chars, expires_days, history_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId,
      template.name,
      domain_pattern,
      template.min_length,
      template.max_length,
      template.require_uppercase,
      template.require_lowercase,
      template.require_numbers,
      template.require_symbols,
      template.excluded_chars || '',
      template.expires_days || 0,
      template.history_count || 0
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: '策略创建成功'
    });
  } catch (error) {
    console.error('从模板创建策略失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 更新策略
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare(`
      SELECT id FROM password_policies WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: '策略不存在' });
    }

    const {
      name, domain_pattern, min_length, max_length,
      require_uppercase, require_lowercase, require_numbers, require_symbols,
      excluded_chars, required_chars, expires_days, history_count, is_default
    } = req.body;

    // 如果设为默认，取消其他默认
    if (is_default) {
      db.prepare(`
        UPDATE password_policies SET is_default = 0 WHERE user_id = ? AND id != ?
      `).run(req.user.userId, req.params.id);
    }

    db.prepare(`
      UPDATE password_policies
      SET name = COALESCE(?, name),
          domain_pattern = COALESCE(?, domain_pattern),
          min_length = COALESCE(?, min_length),
          max_length = COALESCE(?, max_length),
          require_uppercase = COALESCE(?, require_uppercase),
          require_lowercase = COALESCE(?, require_lowercase),
          require_numbers = COALESCE(?, require_numbers),
          require_symbols = COALESCE(?, require_symbols),
          excluded_chars = COALESCE(?, excluded_chars),
          required_chars = COALESCE(?, required_chars),
          expires_days = COALESCE(?, expires_days),
          history_count = COALESCE(?, history_count),
          is_default = COALESCE(?, is_default)
      WHERE id = ? AND user_id = ?
    `).run(
      name, domain_pattern, min_length, max_length,
      require_uppercase, require_lowercase, require_numbers, require_symbols,
      excluded_chars, required_chars, expires_days, history_count, is_default,
      req.params.id, req.user.userId
    );

    res.json({ message: '策略更新成功' });
  } catch (error) {
    console.error('更新策略失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除策略
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM password_policies WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '策略不存在' });
    }

    res.json({ message: '策略删除成功' });
  } catch (error) {
    console.error('删除策略失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

// 验证密码是否符合策略
router.post('/validate', authenticateToken, (req, res) => {
  try {
    const { password, policy_id } = req.body;

    if (!password) {
      return res.status(400).json({ error: '密码是必填的' });
    }

    let policy;
    if (policy_id) {
      policy = db.prepare(`
        SELECT * FROM password_policies WHERE id = ? AND user_id = ?
      `).get(policy_id, req.user.userId);
    }

    if (!policy) {
      policy = {
        min_length: 12,
        max_length: 64,
        require_uppercase: 1,
        require_lowercase: 1,
        require_numbers: 1,
        require_symbols: 1,
        excluded_chars: ''
      };
    }

    const errors = [];

    if (password.length < policy.min_length) {
      errors.push(`密码至少需要 ${policy.min_length} 个字符`);
    }
    if (password.length > policy.max_length) {
      errors.push(`密码最多 ${policy.max_length} 个字符`);
    }
    if (policy.require_uppercase && !/[A-Z]/.test(password)) {
      errors.push('需要包含大写字母');
    }
    if (policy.require_lowercase && !/[a-z]/.test(password)) {
      errors.push('需要包含小写字母');
    }
    if (policy.require_numbers && !/[0-9]/.test(password)) {
      errors.push('需要包含数字');
    }
    if (policy.require_symbols && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('需要包含特殊字符');
    }
    if (policy.excluded_chars) {
      for (const char of policy.excluded_chars) {
        if (password.includes(char)) {
          errors.push(`不能包含字符: ${char}`);
        }
      }
    }

    res.json({
      valid: errors.length === 0,
      errors
    });
  } catch (error) {
    console.error('验证密码失败:', error);
    res.status(500).json({ error: '验证失败' });
  }
});

module.exports = router;
