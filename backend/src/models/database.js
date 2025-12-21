/**
 * 数据库模块 - SQLite
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/vault.db');

let db;

function getDb() {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function initDatabase() {
  const db = getDb();

  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      encryption_salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 密码条目表（存储加密后的数据）
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      category TEXT DEFAULT 'login',
      is_favorite INTEGER DEFAULT 0,
      favorite_order INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 标签表
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name)
    )
  `);

  // 密码条目-标签关联表
  db.exec(`
    CREATE TABLE IF NOT EXISTS item_tags (
      item_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (item_id, tag_id),
      FOREIGN KEY (item_id) REFERENCES vault_items(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // 添加新列（如果不存在）- 用于升级现有数据库
  try {
    db.exec(`ALTER TABLE vault_items ADD COLUMN is_favorite INTEGER DEFAULT 0`);
  } catch (e) {
    // 列已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE vault_items ADD COLUMN favorite_order INTEGER`);
  } catch (e) {
    // 列已存在，忽略错误
  }

  // 创建索引（在添加列之后）
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_vault_items_user_id ON vault_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_vault_items_category ON vault_items(category);
    CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
    CREATE INDEX IF NOT EXISTS idx_item_tags_item ON item_tags(item_id);
    CREATE INDEX IF NOT EXISTS idx_item_tags_tag ON item_tags(tag_id);
  `);

  // 创建收藏索引（需要在列存在之后）
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_vault_items_favorite ON vault_items(user_id, is_favorite)`);
  } catch (e) {
    // 索引已存在或列不存在，忽略错误
  }

  // 2FA 相关列
  try {
    db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`);
  } catch (e) {
    // 列已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`);
  } catch (e) {
    // 列已存在，忽略错误
  }
  try {
    db.exec(`ALTER TABLE users ADD COLUMN backup_codes TEXT`);
  } catch (e) {
    // 列已存在，忽略错误
  }

  // WebAuthn 相关列
  try {
    db.exec(`ALTER TABLE users ADD COLUMN webauthn_credentials TEXT`);
  } catch (e) {
    // 列已存在，忽略错误
  }

  // 共享链接表
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      max_views INTEGER,
      view_count INTEGER DEFAULT 0,
      password_hash TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      revoked INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES vault_items(id) ON DELETE CASCADE
    )
  `);

  // 附件表
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES vault_items(id) ON DELETE CASCADE
    )
  `);

  // 创建共享链接索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);
    CREATE INDEX IF NOT EXISTS idx_shared_links_user_id ON shared_links(user_id);
    CREATE INDEX IF NOT EXISTS idx_shared_links_item_id ON shared_links(item_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_item_id ON attachments(item_id);
  `);

  // ============ 高级功能表 ============

  // 团队/组织表
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      description TEXT,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 团队成员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'member',
      invited_by INTEGER,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(team_id, user_id)
    )
  `);

  // 共享保险箱表
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_vaults (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 共享保险箱条目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS shared_vault_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      category TEXT DEFAULT 'login',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vault_id) REFERENCES shared_vaults(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  // 审计日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      team_id INTEGER,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id INTEGER,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    )
  `);

  // 紧急访问表
  db.exec(`
    CREATE TABLE IF NOT EXISTS emergency_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grantor_id INTEGER NOT NULL,
      grantee_email TEXT NOT NULL,
      grantee_id INTEGER,
      status TEXT DEFAULT 'pending',
      wait_days INTEGER DEFAULT 7,
      access_type TEXT DEFAULT 'view',
      requested_at DATETIME,
      approved_at DATETIME,
      recovery_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (grantor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (grantee_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 暗网监控表
  db.exec(`
    CREATE TABLE IF NOT EXISTS breach_monitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      monitor_type TEXT NOT NULL,
      monitor_value TEXT NOT NULL,
      last_checked DATETIME,
      breach_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 泄露警报表
  db.exec(`
    CREATE TABLE IF NOT EXISTS breach_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      monitor_id INTEGER NOT NULL,
      breach_name TEXT NOT NULL,
      breach_date TEXT,
      breach_data TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (monitor_id) REFERENCES breach_monitors(id) ON DELETE CASCADE
    )
  `);

  // SSH/API 密钥表
  db.exec(`
    CREATE TABLE IF NOT EXISTS secure_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key_type TEXT NOT NULL,
      name TEXT NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      public_key TEXT,
      fingerprint TEXT,
      expires_at DATETIME,
      last_used DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 虚拟身份表
  db.exec(`
    CREATE TABLE IF NOT EXISTS virtual_identities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      alias_email TEXT UNIQUE,
      forward_to TEXT,
      name TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 密码历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES vault_items(id) ON DELETE CASCADE
    )
  `);

  // FIDO2/硬件密钥表
  db.exec(`
    CREATE TABLE IF NOT EXISTS hardware_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      credential_id TEXT UNIQUE NOT NULL,
      public_key TEXT NOT NULL,
      name TEXT,
      counter INTEGER DEFAULT 0,
      transports TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 安全设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      duress_password_hash TEXT,
      self_destruct_attempts INTEGER DEFAULT 10,
      geo_lock_enabled INTEGER DEFAULT 0,
      allowed_countries TEXT,
      require_hardware_key INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 创建高级功能索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
    CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_shared_vault_items_vault ON shared_vault_items(vault_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_team ON audit_logs(team_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_breach_monitors_user ON breach_monitors(user_id);
    CREATE INDEX IF NOT EXISTS idx_breach_alerts_user ON breach_alerts(user_id);
    CREATE INDEX IF NOT EXISTS idx_secure_keys_user ON secure_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_virtual_identities_user ON virtual_identities(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_history_item ON password_history(item_id);
    CREATE INDEX IF NOT EXISTS idx_hardware_keys_user ON hardware_keys(user_id);
  `);

  console.log('✅ Database initialized with advanced features');
}

module.exports = { getDb, initDatabase };
