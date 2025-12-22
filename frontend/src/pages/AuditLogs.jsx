import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function AuditLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [filter, dateRange]);

  const loadLogs = async (loadMore = false) => {
    try {
      const currentPage = loadMore ? page + 1 : 1;
      let url = `/audit/logs?page=${currentPage}&limit=50`;

      if (filter !== 'all') {
        url += `&action=${filter}`;
      }

      const now = new Date();
      let startDate;
      switch (dateRange) {
        case '24hours':
          startDate = new Date(now - 24 * 60 * 60 * 1000);
          break;
        case '7days':
          startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        url += `&start_date=${startDate.toISOString()}`;
      }

      const res = await api.get(url);

      if (loadMore) {
        setLogs([...logs, ...res.data]);
        setPage(currentPage);
      } else {
        setLogs(res.data);
        setPage(1);
      }

      setHasMore(res.data.length === 50);
    } catch (error) {
      console.error('加载失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await api.get(`/audit/export?format=${format}`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('导出失败');
    }
  };

  const getActionIcon = (action) => {
    const icons = {
      login: '🔓',
      logout: '🔒',
      create: '➕',
      update: '✏️',
      delete: '🗑️',
      view: '👁️',
      share: '🔗',
      export: '📤',
      failed_login: '⚠️',
      password_change: '🔑',
      '2fa_enable': '🛡️',
      '2fa_disable': '⛔'
    };
    return icons[action] || '📋';
  };

  const getActionLabel = (action) => {
    const labels = {
      login: '登录',
      logout: '登出',
      create: '创建',
      update: '更新',
      delete: '删除',
      view: '查看',
      share: '分享',
      export: '导出',
      failed_login: '登录失败',
      password_change: '修改密码',
      '2fa_enable': '启用2FA',
      '2fa_disable': '禁用2FA'
    };
    return labels[action] || action;
  };

  const getActionColor = (action) => {
    if (action.includes('delete') || action.includes('failed')) {
      return 'bg-red-100 text-red-800';
    }
    if (action.includes('create') || action.includes('enable')) {
      return 'bg-green-100 text-green-800';
    }
    if (action.includes('update') || action.includes('change')) {
      return 'bg-blue-100 text-blue-800';
    }
    return 'bg-gray-100 text-gray-800';
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
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
                ← 返回
              </button>
              <h1 className="text-xl font-bold">审计日志</h1>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                导出 CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                导出 JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* 过滤器 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">操作类型</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="all">全部</option>
                <option value="login">登录</option>
                <option value="logout">登出</option>
                <option value="create">创建</option>
                <option value="update">更新</option>
                <option value="delete">删除</option>
                <option value="view">查看</option>
                <option value="share">分享</option>
                <option value="failed_login">登录失败</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">时间范围</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="24hours">过去24小时</option>
                <option value="7days">过去7天</option>
                <option value="30days">过去30天</option>
                <option value="90days">过去90天</option>
                <option value="all">全部时间</option>
              </select>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-blue-600">
              {logs.filter(l => l.action === 'login').length}
            </div>
            <div className="text-sm text-gray-500">登录次数</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">
              {logs.filter(l => l.action === 'create').length}
            </div>
            <div className="text-sm text-gray-500">创建操作</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {logs.filter(l => l.action === 'update').length}
            </div>
            <div className="text-sm text-gray-500">更新操作</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-red-600">
              {logs.filter(l => l.action === 'failed_login').length}
            </div>
            <div className="text-sm text-gray-500">失败登录</div>
          </div>
        </div>

        {/* 日志列表 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">时间</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">操作</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">详情</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">IP 地址</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">设备</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    暂无审计日志
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${getActionColor(log.action)}`}>
                        <span className="mr-1">{getActionIcon(log.action)}</span>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.resource_type && (
                        <span className="text-gray-500">[{log.resource_type}] </span>
                      )}
                      {log.details || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {log.ip_address || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {log.user_agent ? (
                        <span title={log.user_agent}>
                          {log.user_agent.includes('Chrome') ? 'Chrome' :
                           log.user_agent.includes('Firefox') ? 'Firefox' :
                           log.user_agent.includes('Safari') ? 'Safari' :
                           log.user_agent.includes('Mobile') ? 'Mobile' : 'Other'}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 加载更多 */}
          {hasMore && logs.length > 0 && (
            <div className="p-4 text-center border-t">
              <button
                onClick={() => loadLogs(true)}
                className="px-4 py-2 text-blue-600 hover:text-blue-800"
              >
                加载更多
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
