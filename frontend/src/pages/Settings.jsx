import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useVault } from '../context/VaultContext';
import { auth as authApi, vault as vaultApi } from '../utils/api';
import { storage } from '../utils/storage';
import { useAutoLockSettings } from '../components/AutoLockProvider';
import { AUTO_LOCK_OPTIONS } from '../hooks/useAutoLock';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout, lock } = useAuth();
  const { getStats, loadItems } = useVault();
  const { settings: lockSettings, updateSettings: updateLockSettings } = useAutoLockSettings();
  const fileInputRef = useRef(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importMode, setImportMode] = useState('merge');
  const [importData, setImportData] = useState(null);

  const stats = getStats();

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordForm.new !== passwordForm.confirm) {
      setError('两次密码不一致');
      return;
    }

    if (passwordForm.new.length < 8) {
      setError('新密码至少8位');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(passwordForm.current, passwordForm.new);
      setSuccess('密码修改成功，请重新登录');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message || '修改失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      logout();
      navigate('/welcome');
    }
  };

  const handleClearData = () => {
    if (window.confirm('确定要清除所有数据吗？此操作不可恢复！')) {
      if (window.confirm('再次确认：您的所有密码将被删除！')) {
        storage.clearAll();
        logout();
        navigate('/welcome');
      }
    }
  };

  const handleLock = () => {
    lock();
    navigate('/unlock');
  };

  // 导出数据
  const handleExport = async () => {
    try {
      setLoading(true);
      const data = await vaultApi.exportData();

      // 创建下载链接
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `password-vault-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess('数据导出成功');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || '导出失败');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // 选择导入文件
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.items || !Array.isArray(data.items)) {
        throw new Error('文件格式不正确');
      }

      // 保存导入数据并显示确认对话框
      setImportData(data);
      setShowImportDialog(true);
      setSuccess(`准备导入 ${data.items.length} 条密码`);
    } catch (err) {
      setError('文件格式错误：' + err.message);
      setTimeout(() => setError(''), 3000);
    }

    // 重置文件输入
    e.target.value = '';
  };

  // 执行导入
  const handleImport = async () => {
    try {
      if (!importData) return;

      setLoading(true);
      const result = await vaultApi.importData(importData.items, importMode);

      setShowImportDialog(false);
      setImportData(null);
      setSuccess(`导入完成：成功 ${result.successCount} 条，失败 ${result.errorCount} 条`);

      // 重新加载数据
      await loadItems();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.message || '导入失败');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="bg-primary-500 text-white px-4 py-4 flex items-center gap-4 safe-top">
        <button onClick={() => navigate(-1)} className="text-2xl">
          ←
        </button>
        <h1 className="text-lg font-bold">设置</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 全局提示 */}
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* 用户信息 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <p className="font-medium text-gray-800">{user?.email}</p>
              <p className="text-sm text-gray-500">密码总数: {stats.total}</p>
            </div>
          </div>
        </div>

        {/* 数据管理 */}
        <div className="bg-white rounded-xl divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              💾 数据管理
            </h3>
          </div>

          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 disabled:opacity-50"
          >
            <div>
              <p className="text-gray-800">导出数据</p>
              <p className="text-sm text-gray-500">将所有密码导出为 JSON 文件（加密）</p>
            </div>
            <span className="text-gray-400">↓</span>
          </button>

          <button
            onClick={handleImportClick}
            disabled={loading}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 disabled:opacity-50"
          >
            <div>
              <p className="text-gray-800">导入数据</p>
              <p className="text-sm text-gray-500">从 JSON 文件导入密码</p>
            </div>
            <span className="text-gray-400">↑</span>
          </button>

          <button
            onClick={() => navigate('/share-history')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-gray-800">共享记录</p>
              <p className="text-sm text-gray-500">管理已创建的共享链接</p>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* 安全设置 */}
        <div className="bg-white rounded-xl divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              🔒 安全设置
            </h3>
          </div>

          {/* 安全中心入口 */}
          <button
            onClick={() => navigate('/security')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="text-gray-800 font-medium">安全中心</p>
                <p className="text-sm text-gray-500">密码健康报告、泄露检测</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          {/* 双因素认证 */}
          <button
            onClick={() => navigate('/2fa-settings')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔐</span>
              <div>
                <p className="text-gray-800 font-medium">双因素认证</p>
                <p className="text-sm text-gray-500">使用验证器应用增强安全性</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          {/* 生物识别解锁 */}
          <button
            onClick={() => navigate('/biometric-settings')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👆</span>
              <div>
                <p className="text-gray-800 font-medium">生物识别解锁</p>
                <p className="text-sm text-gray-500">使用 Touch ID / Face ID 快速解锁</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          {/* 自动锁定时间 */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-gray-800">自动锁定</p>
                <p className="text-sm text-gray-500">无操作后自动锁定</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {AUTO_LOCK_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => updateLockSettings({ autoLockTime: option.value })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    lockSettings.autoLockTime === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 页面隐藏时锁定 */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-800">切换标签页时锁定</p>
              <p className="text-sm text-gray-500">离开页面时自动锁定</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={lockSettings.lockOnHide}
                onChange={(e) => updateLockSettings({ lockOnHide: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          {/* 锁定前提醒 */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-800">锁定前提醒</p>
              <p className="text-sm text-gray-500">锁定前30秒显示倒计时</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={lockSettings.showLockWarning}
                onChange={(e) => updateLockSettings({ showLockWarning: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
            </label>
          </div>

          {/* 快捷键提示 */}
          <div className="p-4">
            <p className="text-gray-800 mb-2">快捷键</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
              </kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Shift</kbd>
              <span>+</span>
              <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">L</kbd>
              <span className="ml-2">快速锁定</span>
            </div>
          </div>

          <button
            onClick={() => setShowChangePassword(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-gray-800">修改主密码</p>
              <p className="text-sm text-gray-500">定期更换密码更安全</p>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={handleLock}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-gray-800">锁定保险箱</p>
              <p className="text-sm text-gray-500">立即锁定，需要密码解锁</p>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          {/* 高级安全设置 */}
          <button
            onClick={() => navigate('/security-advanced')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="text-gray-800 font-medium">高级安全设置</p>
                <p className="text-sm text-gray-500">胁迫密码、自毁机制、硬件密钥</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>

        {/* 高级功能 */}
        <div className="bg-white rounded-xl divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              ⚡ 高级功能
            </h3>
          </div>

          <button
            onClick={() => navigate('/breach-monitor')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔍</span>
              <div>
                <p className="text-gray-800">暗网监控</p>
                <p className="text-sm text-gray-500">检测您的账号是否在数据泄露中</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/teams')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">👥</span>
              <div>
                <p className="text-gray-800">团队管理</p>
                <p className="text-sm text-gray-500">与团队成员共享密码</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/emergency-access')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🆘</span>
              <div>
                <p className="text-gray-800">紧急访问</p>
                <p className="text-sm text-gray-500">设置紧急联系人和数字遗产</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/keys')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <div>
                <p className="text-gray-800">密钥管理</p>
                <p className="text-sm text-gray-500">SSH 密钥、API Token、GPG 密钥</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/identity')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎭</span>
              <div>
                <p className="text-gray-800">隐私工具</p>
                <p className="text-sm text-gray-500">虚拟身份生成、邮箱别名</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/audit-logs')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <p className="text-gray-800">审计日志</p>
                <p className="text-sm text-gray-500">查看所有操作记录</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>

        {/* 更多工具 */}
        <div className="bg-white rounded-xl divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              🛠️ 更多工具
            </h3>
          </div>

          <button
            onClick={() => navigate('/authenticator')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔐</span>
              <div>
                <p className="text-gray-800">身份验证器</p>
                <p className="text-sm text-gray-500">管理 TOTP 两步验证码</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/notes')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <p className="text-gray-800">安全笔记</p>
                <p className="text-sm text-gray-500">加密存储私密笔记</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/cards')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">💳</span>
              <div>
                <p className="text-gray-800">银行卡管理</p>
                <p className="text-sm text-gray-500">安全存储银行卡信息</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/travel-mode')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">✈️</span>
              <div>
                <p className="text-gray-800">旅行模式</p>
                <p className="text-sm text-gray-500">过境时隐藏敏感数据</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/sessions')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-gray-800">会话管理</p>
                <p className="text-sm text-gray-500">查看和撤销活动会话</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/recovery-codes')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔑</span>
              <div>
                <p className="text-gray-800">恢复码管理</p>
                <p className="text-sm text-gray-500">备份恢复码和第三方恢复码</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>

          <button
            onClick={() => navigate('/password-policies')}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">📜</span>
              <div>
                <p className="text-gray-800">密码策略</p>
                <p className="text-sm text-gray-500">为不同网站设置密码规则</p>
              </div>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>

        {/* 关于 */}
        <div className="bg-white rounded-xl divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              ℹ️ 关于
            </h3>
          </div>

          <div className="p-4 flex items-center justify-between">
            <span className="text-gray-800">版本</span>
            <span className="text-gray-500">1.0.0</span>
          </div>

          <div className="p-4">
            <p className="text-sm text-gray-500 leading-relaxed">
              密码保险箱采用端到端加密技术，您的密码在设备上加密后才会上传到服务器。
              我们无法访问您的任何密码数据。
            </p>
          </div>
        </div>

        {/* 危险操作 */}
        <div className="bg-white rounded-xl divide-y">
          <div className="p-4">
            <h3 className="font-medium text-gray-800 flex items-center gap-2">
              ⚠️ 危险操作
            </h3>
          </div>

          <button
            onClick={handleClearData}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50"
          >
            <div>
              <p className="text-red-500">清除所有数据</p>
              <p className="text-sm text-gray-500">删除所有密码并重置应用</p>
            </div>
            <span className="text-gray-400">›</span>
          </button>
        </div>

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-white text-red-500 font-medium rounded-xl border border-gray-200"
        >
          退出登录
        </button>
      </div>

      {/* 修改密码弹窗 */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">修改主密码</h3>
              <button onClick={() => setShowChangePassword(false)} className="text-gray-400">
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-green-50 text-green-600 rounded-lg text-sm">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-600 mb-1">当前密码</label>
                <input
                  type="password"
                  value={passwordForm.current}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">新密码</label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                  className="input"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">确认新密码</label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                  className="input"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-primary-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? '修改中...' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 导入确认对话框 */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-lg">导入数据</h3>
              <button onClick={() => {
                setShowImportDialog(false);
                setImportData(null);
              }} className="text-gray-400">
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                请选择导入模式
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-800">合并导入</p>
                    <p className="text-sm text-gray-500">保留现有密码，添加新密码</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-800">替换导入</p>
                    <p className="text-sm text-red-500">删除现有密码，使用导入数据</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportDialog(false);
                    setImportData(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-lg font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 py-3 bg-primary-500 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {loading ? '导入中...' : '确认导入'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
