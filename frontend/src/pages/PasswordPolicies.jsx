import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function PasswordPolicies() {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState([]);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    domain_pattern: '',
    min_length: 12,
    max_length: 64,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: true,
    excluded_chars: '',
    expires_days: 0,
    history_count: 0,
    is_default: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [policiesRes, templatesRes] = await Promise.all([
        api.get('/policies'),
        api.get('/policies/templates')
      ]);
      setPolicies(policiesRes.data);
      setTemplates(templatesRes.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        require_uppercase: formData.require_uppercase ? 1 : 0,
        require_lowercase: formData.require_lowercase ? 1 : 0,
        require_numbers: formData.require_numbers ? 1 : 0,
        require_symbols: formData.require_symbols ? 1 : 0,
        is_default: formData.is_default ? 1 : 0
      };

      if (selectedPolicy) {
        await api.put(`/policies/${selectedPolicy.id}`, data);
      } else {
        await api.post('/policies', data);
      }
      setShowForm(false);
      setSelectedPolicy(null);
      resetForm();
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '保存失败');
    }
  };

  const handleDeletePolicy = async (id) => {
    if (!confirm('确定删除此策略？')) return;
    try {
      await api.delete(`/policies/${id}`);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '删除失败');
    }
  };

  const handleCreateFromTemplate = async (templateId) => {
    const domain = prompt('请输入要应用此策略的域名模式（如 *.bank.com）:');
    if (!domain) return;

    try {
      await api.post('/policies/from-template', {
        template_id: templateId,
        domain_pattern: domain
      });
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const handleEditPolicy = (policy) => {
    setSelectedPolicy(policy);
    setFormData({
      name: policy.name,
      domain_pattern: policy.domain_pattern || '',
      min_length: policy.min_length,
      max_length: policy.max_length,
      require_uppercase: !!policy.require_uppercase,
      require_lowercase: !!policy.require_lowercase,
      require_numbers: !!policy.require_numbers,
      require_symbols: !!policy.require_symbols,
      excluded_chars: policy.excluded_chars || '',
      expires_days: policy.expires_days || 0,
      history_count: policy.history_count || 0,
      is_default: !!policy.is_default
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      domain_pattern: '',
      min_length: 12,
      max_length: 64,
      require_uppercase: true,
      require_lowercase: true,
      require_numbers: true,
      require_symbols: true,
      excluded_chars: '',
      expires_days: 0,
      history_count: 0,
      is_default: false
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">密码策略</h1>
            </div>
            <button
              onClick={() => {
                resetForm();
                setSelectedPolicy(null);
                setShowForm(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建策略
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 预设模板 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-4">快速创建（预设模板）</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(templates).map(([id, template]) => (
              <button
                key={id}
                onClick={() => handleCreateFromTemplate(id)}
                className="p-3 border rounded-lg text-left hover:bg-gray-50"
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {template.min_length}-{template.max_length}位
                  {template.expires_days > 0 && ` · ${template.expires_days}天过期`}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 我的策略 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">我的策略</h2>
          </div>
          {policies.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p>暂无自定义策略</p>
            </div>
          ) : (
            <div className="divide-y">
              {policies.map(policy => (
                <div key={policy.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center">
                        {policy.name}
                        {policy.is_default && (
                          <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded-full">
                            默认
                          </span>
                        )}
                      </div>
                      {policy.domain_pattern && (
                        <div className="text-sm text-gray-500 mt-1">
                          应用于: {policy.domain_pattern}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-2 py-1 bg-gray-100 text-xs rounded">
                          {policy.min_length}-{policy.max_length}位
                        </span>
                        {policy.require_uppercase && (
                          <span className="px-2 py-1 bg-gray-100 text-xs rounded">大写字母</span>
                        )}
                        {policy.require_lowercase && (
                          <span className="px-2 py-1 bg-gray-100 text-xs rounded">小写字母</span>
                        )}
                        {policy.require_numbers && (
                          <span className="px-2 py-1 bg-gray-100 text-xs rounded">数字</span>
                        )}
                        {policy.require_symbols && (
                          <span className="px-2 py-1 bg-gray-100 text-xs rounded">符号</span>
                        )}
                        {policy.expires_days > 0 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                            {policy.expires_days}天过期
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditPolicy(policy)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeletePolicy(policy.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">密码策略用途</h3>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>为不同网站设置不同的密码要求</li>
            <li>使用域名模式自动匹配（如 *.bank.com）</li>
            <li>设置密码过期提醒</li>
            <li>生成密码时自动应用对应策略</li>
          </ul>
        </div>
      </div>

      {/* 创建/编辑策略表单 */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold">
                {selectedPolicy ? '编辑策略' : '创建策略'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSavePolicy} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">策略名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="如: 银行账户策略"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">域名模式</label>
                <input
                  type="text"
                  value={formData.domain_pattern}
                  onChange={(e) => setFormData({ ...formData, domain_pattern: e.target.value })}
                  placeholder="如: *.bank.com 或 github.com"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">* 代表任意字符</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">最小长度</label>
                  <input
                    type="number"
                    value={formData.min_length}
                    onChange={(e) => setFormData({ ...formData, min_length: parseInt(e.target.value) })}
                    min={6}
                    max={128}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">最大长度</label>
                  <input
                    type="number"
                    value={formData.max_length}
                    onChange={(e) => setFormData({ ...formData, max_length: parseInt(e.target.value) })}
                    min={6}
                    max={128}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">字符要求</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.require_uppercase}
                      onChange={(e) => setFormData({ ...formData, require_uppercase: e.target.checked })}
                    />
                    <span>大写字母 (A-Z)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.require_lowercase}
                      onChange={(e) => setFormData({ ...formData, require_lowercase: e.target.checked })}
                    />
                    <span>小写字母 (a-z)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.require_numbers}
                      onChange={(e) => setFormData({ ...formData, require_numbers: e.target.checked })}
                    />
                    <span>数字 (0-9)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.require_symbols}
                      onChange={(e) => setFormData({ ...formData, require_symbols: e.target.checked })}
                    />
                    <span>符号 (!@#$...)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">排除字符</label>
                <input
                  type="text"
                  value={formData.excluded_chars}
                  onChange={(e) => setFormData({ ...formData, excluded_chars: e.target.value })}
                  placeholder="如: lI1O0"
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">避免使用容易混淆的字符</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">密码过期天数</label>
                  <input
                    type="number"
                    value={formData.expires_days}
                    onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) })}
                    min={0}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">0 = 不过期</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">历史记录数</label>
                  <input
                    type="number"
                    value={formData.history_count}
                    onChange={(e) => setFormData({ ...formData, history_count: parseInt(e.target.value) })}
                    min={0}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">不能重复使用的密码数</p>
                </div>
              </div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <span>设为默认策略</span>
              </label>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
