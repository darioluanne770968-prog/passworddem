/**
 * Password Vault - Backend API Server
 * 密码保险箱后端服务
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');
const tagsRoutes = require('./routes/tags');
const securityRoutes = require('./routes/security');
const twofaRoutes = require('./routes/twofa');
const webauthnRoutes = require('./routes/webauthn');
const shareRoutes = require('./routes/share');
const attachmentsRoutes = require('./routes/attachments');
// 高级功能路由
const breachRoutes = require('./routes/breach');
const teamsRoutes = require('./routes/teams');
const emergencyRoutes = require('./routes/emergency');
const securityAdvancedRoutes = require('./routes/security-advanced');
const auditRoutes = require('./routes/audit');
const keysRoutes = require('./routes/keys');
const identityRoutes = require('./routes/identity');
// 新增高级功能路由
const totpRoutes = require('./routes/totp');
const notesRoutes = require('./routes/notes');
const cardsRoutes = require('./routes/cards');
const travelRoutes = require('./routes/travel');
const sessionsRoutes = require('./routes/sessions');
const recoveryRoutes = require('./routes/recovery');
const policiesRoutes = require('./routes/policies');
const qrshareRoutes = require('./routes/qrshare');
const { initDatabase } = require('./models/database');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// 请求限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP最多100次请求
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

// 解析JSON
app.use(express.json({ limit: '1mb' }));

// 初始化数据库
initDatabase();

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/2fa', twofaRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/attachments', attachmentsRoutes);
// 高级功能路由
app.use('/api/breach', breachRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/security-advanced', securityAdvancedRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/identity', identityRoutes);
// 新增高级功能路由
app.use('/api/totp', totpRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/travel', travelRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/recovery', recoveryRoutes);
app.use('/api/policies', policiesRoutes);
app.use('/api/qrshare', qrshareRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

app.listen(PORT, () => {
  console.log(`🔐 Password Vault API running on http://localhost:${PORT}`);
});

module.exports = app;
