const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/database');

// 初始化银行卡表
db.exec(`
  CREATE TABLE IF NOT EXISTS bank_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    card_number TEXT NOT NULL,
    card_type TEXT DEFAULT 'credit',
    brand TEXT,
    holder_name TEXT,
    expiry_month TEXT,
    expiry_year TEXT,
    cvv TEXT,
    pin TEXT,
    billing_address TEXT,
    notes TEXT,
    color TEXT DEFAULT '#1a1a2e',
    is_favorite INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// 检测卡品牌
function detectCardBrand(number) {
  const patterns = {
    visa: /^4/,
    mastercard: /^5[1-5]/,
    amex: /^3[47]/,
    discover: /^6(?:011|5)/,
    unionpay: /^62/,
    jcb: /^35/,
    diners: /^3(?:0[0-5]|[68])/
  };

  const cleanNumber = number.replace(/\s/g, '');
  for (const [brand, pattern] of Object.entries(patterns)) {
    if (pattern.test(cleanNumber)) {
      return brand;
    }
  }
  return 'unknown';
}

// 格式化卡号显示
function formatCardNumber(number) {
  const clean = number.replace(/\s/g, '');
  return clean.replace(/(.{4})/g, '$1 ').trim();
}

// 掩码卡号
function maskCardNumber(number) {
  const clean = number.replace(/\s/g, '');
  if (clean.length < 8) return clean;
  return clean.slice(0, 4) + ' **** **** ' + clean.slice(-4);
}

// 获取所有银行卡
router.get('/', authenticateToken, (req, res) => {
  try {
    const cards = db.prepare(`
      SELECT id, name, card_number, card_type, brand, holder_name,
             expiry_month, expiry_year, billing_address, notes, color,
             is_favorite, created_at, updated_at
      FROM bank_cards
      WHERE user_id = ?
      ORDER BY is_favorite DESC, name ASC
    `).all(req.user.userId);

    // 返回掩码后的卡号
    const maskedCards = cards.map(card => ({
      ...card,
      card_number_masked: maskCardNumber(card.card_number),
      card_number: undefined // 不直接返回完整卡号
    }));

    res.json(maskedCards);
  } catch (error) {
    console.error('获取银行卡失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取单个银行卡完整信息
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const card = db.prepare(`
      SELECT * FROM bank_cards
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!card) {
      return res.status(404).json({ error: '银行卡不存在' });
    }

    // 格式化显示
    card.card_number_formatted = formatCardNumber(card.card_number);

    res.json(card);
  } catch (error) {
    console.error('获取银行卡失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 添加银行卡
router.post('/', authenticateToken, (req, res) => {
  try {
    const {
      name,
      card_number,
      card_type = 'credit',
      holder_name,
      expiry_month,
      expiry_year,
      cvv,
      pin,
      billing_address,
      notes,
      color = '#1a1a2e'
    } = req.body;

    if (!name || !card_number) {
      return res.status(400).json({ error: '名称和卡号是必填的' });
    }

    const cleanNumber = card_number.replace(/\s/g, '');
    const brand = detectCardBrand(cleanNumber);

    const result = db.prepare(`
      INSERT INTO bank_cards (
        user_id, name, card_number, card_type, brand, holder_name,
        expiry_month, expiry_year, cvv, pin, billing_address, notes, color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.userId, name, cleanNumber, card_type, brand, holder_name,
      expiry_month, expiry_year, cvv, pin, billing_address, notes, color
    );

    res.status(201).json({
      id: result.lastInsertRowid,
      message: '添加成功'
    });
  } catch (error) {
    console.error('添加银行卡失败:', error);
    res.status(500).json({ error: '添加失败' });
  }
});

// 更新银行卡
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare(`
      SELECT id FROM bank_cards WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: '银行卡不存在' });
    }

    const {
      name, card_number, card_type, holder_name,
      expiry_month, expiry_year, cvv, pin,
      billing_address, notes, color, is_favorite
    } = req.body;

    let brand = null;
    let cleanNumber = null;
    if (card_number) {
      cleanNumber = card_number.replace(/\s/g, '');
      brand = detectCardBrand(cleanNumber);
    }

    db.prepare(`
      UPDATE bank_cards
      SET name = COALESCE(?, name),
          card_number = COALESCE(?, card_number),
          card_type = COALESCE(?, card_type),
          brand = COALESCE(?, brand),
          holder_name = COALESCE(?, holder_name),
          expiry_month = COALESCE(?, expiry_month),
          expiry_year = COALESCE(?, expiry_year),
          cvv = COALESCE(?, cvv),
          pin = COALESCE(?, pin),
          billing_address = COALESCE(?, billing_address),
          notes = COALESCE(?, notes),
          color = COALESCE(?, color),
          is_favorite = COALESCE(?, is_favorite),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(
      name, cleanNumber, card_type, brand, holder_name,
      expiry_month, expiry_year, cvv, pin,
      billing_address, notes, color, is_favorite,
      req.params.id, req.user.userId
    );

    res.json({ message: '更新成功' });
  } catch (error) {
    console.error('更新银行卡失败:', error);
    res.status(500).json({ error: '更新失败' });
  }
});

// 切换收藏
router.post('/:id/favorite', authenticateToken, (req, res) => {
  try {
    const card = db.prepare(`
      SELECT is_favorite FROM bank_cards WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.userId);

    if (!card) {
      return res.status(404).json({ error: '银行卡不存在' });
    }

    db.prepare(`
      UPDATE bank_cards
      SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(card.is_favorite ? 0 : 1, req.params.id, req.user.userId);

    res.json({ is_favorite: !card.is_favorite });
  } catch (error) {
    console.error('切换收藏失败:', error);
    res.status(500).json({ error: '操作失败' });
  }
});

// 删除银行卡
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM bank_cards WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: '银行卡不存在' });
    }

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('删除银行卡失败:', error);
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
