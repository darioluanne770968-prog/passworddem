import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Teams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(null);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamVaults, setTeamVaults] = useState([]);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const res = await api.get('/teams');
      setTeams(res.data);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    try {
      await api.post('/teams', newTeam);
      setNewTeam({ name: '', description: '' });
      setShowCreateForm(false);
      await loadTeams();
    } catch (error) {
      alert(error.response?.data?.error || '创建失败');
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/teams/${showInviteForm}/members`, {
        email: inviteEmail,
        role: inviteRole
      });
      setInviteEmail('');
      setInviteRole('viewer');
      setShowInviteForm(null);
      await loadTeamDetails(showInviteForm);
    } catch (error) {
      alert(error.response?.data?.error || '邀请失败');
    }
  };

  const loadTeamDetails = async (teamId) => {
    try {
      const [teamRes, vaultsRes] = await Promise.all([
        api.get(`/teams/${teamId}`),
        api.get(`/teams/${teamId}/vaults`)
      ]);
      setSelectedTeam(teamRes.data);
      setTeamVaults(vaultsRes.data);
    } catch (error) {
      console.error('加载团队详情失败:', error);
    }
  };

  const handleRemoveMember = async (teamId, memberId) => {
    if (!confirm('确定移除此成员？')) return;
    try {
      await api.delete(`/teams/${teamId}/members/${memberId}`);
      await loadTeamDetails(teamId);
    } catch (error) {
      alert(error.response?.data?.error || '移除失败');
    }
  };

  const handleLeaveTeam = async (teamId) => {
    if (!confirm('确定退出此团队？')) return;
    try {
      await api.post(`/teams/${teamId}/leave`);
      setSelectedTeam(null);
      await loadTeams();
    } catch (error) {
      alert(error.response?.data?.error || '退出失败');
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800',
      editor: 'bg-blue-100 text-blue-800',
      viewer: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      admin: '管理员',
      editor: '编辑者',
      viewer: '查看者'
    };
    return (
      <span className={`text-xs px-2 py-1 rounded-full ${badges[role]}`}>
        {labels[role]}
      </span>
    );
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
              <h1 className="text-xl font-bold">团队管理</h1>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              创建团队
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 团队列表 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">我的团队</h2>
              {teams.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  暂无团队，创建一个开始协作吧
                </p>
              ) : (
                <div className="space-y-2">
                  {teams.map(team => (
                    <button
                      key={team.id}
                      onClick={() => loadTeamDetails(team.id)}
                      className={`w-full text-left p-3 rounded-lg transition ${
                        selectedTeam?.id === team.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{team.name}</div>
                      <div className="text-sm text-gray-500 flex items-center space-x-2">
                        <span>{team.member_count || 1} 成员</span>
                        {getRoleBadge(team.role)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 团队详情 */}
          <div className="lg:col-span-2">
            {selectedTeam ? (
              <div className="space-y-6">
                {/* 团队信息 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
                      {selectedTeam.description && (
                        <p className="text-gray-600 mt-1">{selectedTeam.description}</p>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      {selectedTeam.role === 'admin' && (
                        <button
                          onClick={() => setShowInviteForm(selectedTeam.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          邀请成员
                        </button>
                      )}
                      <button
                        onClick={() => handleLeaveTeam(selectedTeam.id)}
                        className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded-lg hover:bg-red-200"
                      >
                        退出团队
                      </button>
                    </div>
                  </div>

                  {/* 成员列表 */}
                  <h3 className="font-semibold mb-3">成员</h3>
                  <div className="space-y-2">
                    {selectedTeam.members?.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                            {member.email?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{member.email}</div>
                            <div className="text-sm text-gray-500">
                              加入于 {new Date(member.joined_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getRoleBadge(member.role)}
                          {selectedTeam.role === 'admin' && member.role !== 'admin' && (
                            <button
                              onClick={() => handleRemoveMember(selectedTeam.id, member.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                            >
                              移除
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 共享保险库 */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">共享保险库</h3>
                  {teamVaults.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">暂无共享保险库</p>
                  ) : (
                    <div className="space-y-2">
                      {teamVaults.map(vault => (
                        <div key={vault.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{vault.name}</div>
                            <div className="text-sm text-gray-500">{vault.item_count || 0} 个密码</div>
                          </div>
                          <button className="text-blue-600 hover:text-blue-800 text-sm">
                            查看
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                选择一个团队查看详情
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 创建团队表单 */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">创建团队</h3>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">团队名称</label>
                <input
                  type="text"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="我的团队"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">描述（可选）</label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  placeholder="团队描述..."
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  创建
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 邀请成员表单 */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">邀请成员</h3>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">邮箱地址</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">角色</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="viewer">查看者 - 只能查看密码</option>
                  <option value="editor">编辑者 - 可以添加/编辑密码</option>
                  <option value="admin">管理员 - 完全控制权限</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowInviteForm(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  发送邀请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
