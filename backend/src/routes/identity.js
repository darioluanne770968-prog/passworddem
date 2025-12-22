/**
 * 虚拟身份 / 隐私增强 API
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../models/database');
const { authMiddleware: auth } = require('../middleware/auth');
const crypto = require('crypto');

// ============ 虚拟邮箱 ============

// 获取虚拟邮箱列表
router.get('/emails', auth, (req, res) => {
  try {
    const db = getDb();
    const emails = db.prepare(`
      SELECT id, alias_email, forward_to, notes, is_active, created_at
      FROM virtual_identities
      WHERE user_id = ? AND alias_email IS NOT NULL
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
});

// 创建虚拟邮箱
router.post('/emails', auth, (req, res) => {
  try {
    const { forward_to, notes } = req.body;
    const db = getDb();

    // 生成随机邮箱地址
    const random = crypto.randomBytes(8).toString('hex');
    const domain = process.env.ALIAS_DOMAIN || 'alias.passwordvault.local';
    const aliasEmail = `${random}@${domain}`;

    const result = db.prepare(`
      INSERT INTO virtual_identities (user_id, alias_email, forward_to, notes)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, aliasEmail, forward_to, notes);

    res.status(201).json({
      id: result.lastInsertRowid,
      alias_email: aliasEmail,
      forward_to,
      notes
    });
  } catch (error) {
    console.error('创建虚拟邮箱失败:', error);
    res.status(500).json({ error: '创建失败' });
  }
});

// 更新虚拟邮箱
router.patch('/emails/:id', auth, (req, res) => {
  try {
    const { forward_to, is_active, notes } = req.body;
    const db = getDb();

    const updates = [];
    const params = [];

    if (forward_to !== undefined) {
      updates.push('forward_to = ?');
      params.push(forward_to);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }

    if (updates.length > 0) {
      params.push(req.params.id, req.user.id);
      db.prepare(`
        UPDATE virtual_identities SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
      `).run(...params);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '更新失败' });
  }
});

// 删除虚拟邮箱
router.delete('/emails/:id', auth, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM virtual_identities WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: '删除失败' });
  }
});

// ============ 身份生成器 ============

// 生成随机身份
router.post('/generate', auth, (req, res) => {
  try {
    const { locale = 'zh-CN', save = false } = req.body;

    // 中文名字数据
    const surnames = ['李', '王', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴', '徐', '孙', '马', '朱', '胡'];
    const givenNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛'];

    // 英文名字数据
    const enFirstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth'];
    const enLastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];

    // 生成身份
    let identity;

    if (locale === 'zh-CN') {
      const surname = surnames[Math.floor(Math.random() * surnames.length)];
      const given1 = givenNames[Math.floor(Math.random() * givenNames.length)];
      const given2 = Math.random() > 0.5 ? givenNames[Math.floor(Math.random() * givenNames.length)] : '';

      identity = {
        name: surname + given1 + given2,
        phone: generatePhone('CN'),
        email: generateEmail(surname + given1 + given2),
        address: generateAddress('CN'),
        idNumber: generateIdNumber(),
        birthDate: generateBirthDate()
      };
    } else {
      const firstName = enFirstNames[Math.floor(Math.random() * enFirstNames.length)];
      const lastName = enLastNames[Math.floor(Math.random() * enLastNames.length)];

      identity = {
        name: `${firstName} ${lastName}`,
        phone: generatePhone('US'),
        email: generateEmail(`${firstName}.${lastName}`),
        address: generateAddress('US'),
        ssn: generateSSN(),
        birthDate: generateBirthDate()
      };
    }

    // 保存身份
    if (save) {
      const db = getDb();
      db.prepare(`
        INSERT INTO virtual_identities (user_id, name, phone, address, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        identity.name,
        identity.phone,
        identity.address,
        JSON.stringify(identity)
      );
    }

    res.json(identity);
  } catch (error) {
    console.error('生成身份失败:', error);
    res.status(500).json({ error: '生成失败' });
  }
});

// 获取保存的身份
router.get('/saved', auth, (req, res) => {
  try {
    const db = getDb();
    const identities = db.prepare(`
      SELECT id, name, phone, address, notes, created_at
      FROM virtual_identities
      WHERE user_id = ? AND name IS NOT NULL
      ORDER BY created_at DESC
    `).all(req.user.id);

    res.json(identities.map(i => ({
      ...i,
      details: i.notes ? JSON.parse(i.notes) : null
    })));
  } catch (error) {
    res.status(500).json({ error: '获取失败' });
  }
});

// ============ 辅助函数 ============

function generatePhone(country) {
  if (country === 'CN') {
    const prefixes = ['138', '139', '136', '137', '158', '159', '188', '189'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return prefix + suffix;
  } else {
    const areaCode = Math.floor(Math.random() * 900) + 100;
    const exchange = Math.floor(Math.random() * 900) + 100;
    const subscriber = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
}

function generateEmail(name) {
  const domains = ['gmail.com', 'outlook.com', 'yahoo.com', '163.com', 'qq.com'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.floor(Math.random() * 1000);
  return `${cleanName}${random}@${domain}`;
}

function generateAddress(country) {
  if (country === 'CN') {
    const provinces = ['北京市', '上海市', '广东省', '浙江省', '江苏省'];
    const districts = ['海淀区', '朝阳区', '浦东新区', '西湖区', '鼓楼区'];
    const streets = ['中关村大街', '建国路', '南京路', '延安路', '长江路'];
    const province = provinces[Math.floor(Math.random() * provinces.length)];
    const district = districts[Math.floor(Math.random() * districts.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const number = Math.floor(Math.random() * 200) + 1;
    return `${province}${district}${street}${number}号`;
  } else {
    const streets = ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine Rd'];
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    const states = ['NY', 'CA', 'IL', 'TX', 'AZ'];
    const number = Math.floor(Math.random() * 9999) + 1;
    const street = streets[Math.floor(Math.random() * streets.length)];
    const cityIndex = Math.floor(Math.random() * cities.length);
    const zip = Math.floor(Math.random() * 90000) + 10000;
    return `${number} ${street}, ${cities[cityIndex]}, ${states[cityIndex]} ${zip}`;
  }
}

function generateIdNumber() {
  // 生成模拟身份证号（非真实有效）
  const areas = ['110101', '310101', '440301', '330102', '320102'];
  const area = areas[Math.floor(Math.random() * areas.length)];
  const year = Math.floor(Math.random() * 30) + 1970;
  const month = (Math.floor(Math.random() * 12) + 1).toString().padStart(2, '0');
  const day = (Math.floor(Math.random() * 28) + 1).toString().padStart(2, '0');
  const seq = Math.floor(Math.random() * 900) + 100;
  const checkDigit = Math.floor(Math.random() * 10);
  return `${area}${year}${month}${day}${seq}${checkDigit}`;
}

function generateSSN() {
  // 生成模拟 SSN（非真实有效）
  const area = Math.floor(Math.random() * 900) + 100;
  const group = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const serial = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${area}-${group}-${serial}`;
}

function generateBirthDate() {
  const year = Math.floor(Math.random() * 40) + 1960;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

module.exports = router;
