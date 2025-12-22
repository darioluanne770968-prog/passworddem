import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function EmergencyAccess() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContact, setNewContact] = useState({
    email: '',
    wait_period_days: 7
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contactsRes, requestsRes] = await Promise.all([
        api.get('/emergency/contacts'),
        api.get('/emergency/requests')
      ]);
      setContacts(contactsRes.data);
      setPendingRequests(requestsRes.data.filter(r => r.status === 'pending'));
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    try {
      await api.post('/emergency/contacts', newContact);
      setNewContact({ email: '', wait_period_days: 7 });
      setShowAddForm(false);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '添加失败');
    }
  };

  const handleRemoveContact = async (id) => {
    if (!confirm('确定移除此紧急联系人？')) return;
    try {
      await api.delete(`/emergency/contacts/${id}`);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '移除失败');
    }
  };

  const handleApproveRequest = async (id) => {
    if (!confirm('确定批准此请求？对方将立即获得访问权限。')) return;
    try {
      await api.post(`/emergency/requests/${id}/approve`);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const handleRejectRequest = async (id) => {
    if (!confirm('确定拒绝此请求？')) return;
    try {
      await api.post(`/emergency/requests/${id}/reject`);
      await loadData();
    } catch (error) {
      alert(error.response?.data?.error || '操作失败');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      expired: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      pending: '等待中',
      approved: '已批准',
      rejected: '已拒绝',
      expired: '已过期'
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${badges[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const calculateTimeRemaining = (createdAt, waitDays) => {
    const created = new Date(createdAt);
    const accessDate = new Date(created.getTime() + waitDays * 24 * 60 * 60 * 1000);
    const now = new Date();
    const remaining = accessDate - now;

    if (remaining <= 0) return '可立即访问';

    const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    if (days > 0) return `${days}天${hours}小时后`;
    return `${hours}小时后`;
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
        <div className="max-w-4xl mx-auto px-4 pb-4" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">紧急访问 / 数字遗产</h1>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              添加紧急联系人
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 说明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">什么是紧急访问？</h3>
          <p className="text-sm text-blue-800">
            紧急访问允许您指定信任的联系人在紧急情况下访问您的密码库。
            当联系人发起访问请求时，会有一个等待期（您可以设置天数）。
            在等待期内，您可以随时拒绝请求。如果您没有响应，等待期结束后他们将获得访问权限。
          </p>
        </div>

        {/* 待处理请求 */}
        {pendingRequests.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2 animate-pulse"></span>
              待处理的访问请求
            </h2>
            <div className="space-y-3">
              {pendingRequests.map(request => (
                <div key={request.id} className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{request.requester_email}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        请求时间: {new Date(request.created_at).toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">
                        自动批准: {calculateTimeRemaining(request.created_at, request.wait_period_days)}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleApproveRequest(request.id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        批准
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        拒绝
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 紧急联系人列表 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">我的紧急联系人</h2>
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🛡️</div>
              <p className="text-gray-500">
                暂未设置紧急联系人
              </p>
              <p className="text-sm text-gray-400 mt-2">
                添加信任的人作为紧急联系人，以便在需要时访问您的密码库
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {contacts.map(contact => (
                <div key={contact.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {contact.contact_email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">{contact.contact_email}</div>
                      <div className="text-sm text-gray-500">
                        等待期: {contact.wait_period_days} 天
                      </div>
                      <div className="text-sm text-gray-500">
                        添加于: {new Date(contact.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveContact(contact.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 我可访问的保险库 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">我可紧急访问的保险库</h2>
          <p className="text-gray-500 text-center py-8">
            当其他用户将您设为紧急联系人时，您可以在这里发起访问请求
          </p>
        </div>
      </div>

      {/* 添加联系人表单 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加紧急联系人</h3>
            <form onSubmit={handleAddContact} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">联系人邮箱</label>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="contact@example.com"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  对方需要已注册密码保险箱账号
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">等待期（天）</label>
                <select
                  value={newContact.wait_period_days}
                  onChange={(e) => setNewContact({ ...newContact, wait_period_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value={1}>1 天</option>
                  <option value={3}>3 天</option>
                  <option value={7}>7 天（推荐）</option>
                  <option value={14}>14 天</option>
                  <option value={30}>30 天</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  对方发起请求后，您有这么多天时间来拒绝请求
                </p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ 请谨慎选择紧急联系人。如果您在等待期内未能响应，对方将能够访问您的密码库。
                </p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
