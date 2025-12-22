/**
 * API 请求模块
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || '请求失败', response.status);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('网络错误，请检查连接', 0);
  }
}

// 认证相关
export const auth = {
  register: (email, password) =>
    request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  login: (email, password, totpToken = null) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, totpToken })
    }),

  getMe: () => request('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    })
};

// 双因素认证相关
export const twoFactor = {
  getStatus: () => request('/2fa/status'),

  setup: () =>
    request('/2fa/setup', { method: 'POST' }),

  enable: (token) =>
    request('/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),

  disable: (token) =>
    request('/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),

  regenerateBackup: (token) =>
    request('/2fa/regenerate-backup', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
};

// 密码库相关
export const vault = {
  getItems: () => request('/vault/items'),

  getItem: (id) => request(`/vault/items/${id}`),

  createItem: (encryptedData, iv, category) =>
    request('/vault/items', {
      method: 'POST',
      body: JSON.stringify({ encryptedData, iv, category })
    }),

  updateItem: (id, encryptedData, iv, category) =>
    request(`/vault/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ encryptedData, iv, category })
    }),

  deleteItem: (id) =>
    request(`/vault/items/${id}`, { method: 'DELETE' }),

  sync: (items, lastSyncTime) =>
    request('/vault/sync', {
      method: 'POST',
      body: JSON.stringify({ items, lastSyncTime })
    }),

  getStats: () => request('/vault/stats'),

  exportData: () => request('/vault/export'),

  importData: (items, mode = 'merge') =>
    request('/vault/import', {
      method: 'POST',
      body: JSON.stringify({ items, mode })
    }),

  // 收藏相关
  getFavorites: () => request('/vault/favorites'),

  toggleFavorite: (id) =>
    request(`/vault/items/${id}/favorite`, { method: 'POST' }),

  reorderFavorites: (items) =>
    request('/vault/favorites/reorder', {
      method: 'PUT',
      body: JSON.stringify({ items })
    })
};

// WebAuthn (生物识别) 相关
export const webauthn = {
  getStatus: () => request('/webauthn/status'),

  getRegisterOptions: () =>
    request('/webauthn/register-options', { method: 'POST' }),

  register: (credential, deviceName) =>
    request('/webauthn/register', {
      method: 'POST',
      body: JSON.stringify({ credential, deviceName })
    }),

  getAuthenticateOptions: (email) =>
    request('/webauthn/authenticate-options', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),

  authenticate: (email, credential) =>
    request('/webauthn/authenticate', {
      method: 'POST',
      body: JSON.stringify({ email, credential })
    }),

  getCredentials: () => request('/webauthn/credentials'),

  deleteCredential: (credentialId) =>
    request(`/webauthn/credential/${encodeURIComponent(credentialId)}`, { method: 'DELETE' })
};

// 共享链接相关
export const share = {
  create: (itemId, expiresIn, maxViews, password, encryptedData, iv) =>
    request('/share', {
      method: 'POST',
      body: JSON.stringify({ itemId, expiresIn, maxViews, password, encryptedData, iv })
    }),

  getList: () => request('/share'),

  revoke: (id) =>
    request(`/share/${id}`, { method: 'DELETE' }),

  check: (token) =>
    request(`/share/check/${token}`),

  access: (token, password = null) =>
    request(`/share/access/${token}`, {
      method: 'POST',
      body: JSON.stringify({ password })
    })
};

// 附件相关
export const attachments = {
  upload: (itemId, filename, mimeType, encryptedData, iv) =>
    request('/attachments', {
      method: 'POST',
      body: JSON.stringify({ itemId, filename, mimeType, encryptedData, iv })
    }),

  getByItem: (itemId) =>
    request(`/attachments/item/${itemId}`),

  get: (id) =>
    request(`/attachments/${id}`),

  delete: (id) =>
    request(`/attachments/${id}`, { method: 'DELETE' }),

  getStats: () =>
    request('/attachments/stats/summary')
};

// 标签相关
export const tags = {
  getAll: () => request('/tags'),

  create: (name, color) =>
    request('/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color })
    }),

  update: (id, name, color) =>
    request(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color })
    }),

  delete: (id) =>
    request(`/tags/${id}`, { method: 'DELETE' }),

  getItemsByTag: (tagId) => request(`/tags/${tagId}/items`),

  // 密码条目标签
  getItemTags: (itemId) => request(`/tags/items/${itemId}/tags`),

  setItemTags: (itemId, tagIds) =>
    request(`/tags/items/${itemId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagIds })
    })
};

export { ApiError };

// Default export for backward compatibility
const api = {
  auth,
  twoFactor,
  vault,
  webauthn,
  share,
  attachments,
  tags,
  request
};

export default api;
