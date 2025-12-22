/**
 * 安全存储工具类
 * 在 iOS 上使用 Keychain，在 Web 上使用 localStorage
 */

import { Capacitor } from '@capacitor/core';

// 动态导入原生插件
let SecureStoragePlugin = null;

async function loadNativePlugin() {
  if (Capacitor.isNativePlatform() && !SecureStoragePlugin) {
    try {
      const module = await import('capacitor-secure-storage-plugin');
      SecureStoragePlugin = module.SecureStoragePlugin;
    } catch (e) {
      console.warn('安全存储插件加载失败:', e);
    }
  }
  return SecureStoragePlugin;
}

/**
 * 检测是否为原生平台
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * 存储键值对
 * @param {string} key - 键名
 * @param {string} value - 值（字符串）
 * @returns {Promise<boolean>}
 */
export async function setItem(key, value) {
  if (isNative()) {
    return setItemNative(key, value);
  } else {
    return setItemWeb(key, value);
  }
}

/**
 * 获取值
 * @param {string} key - 键名
 * @returns {Promise<string|null>}
 */
export async function getItem(key) {
  if (isNative()) {
    return getItemNative(key);
  } else {
    return getItemWeb(key);
  }
}

/**
 * 删除键值对
 * @param {string} key - 键名
 * @returns {Promise<boolean>}
 */
export async function removeItem(key) {
  if (isNative()) {
    return removeItemNative(key);
  } else {
    return removeItemWeb(key);
  }
}

/**
 * 清除所有存储
 * @returns {Promise<boolean>}
 */
export async function clear() {
  if (isNative()) {
    return clearNative();
  } else {
    return clearWeb();
  }
}

/**
 * 获取所有键
 * @returns {Promise<string[]>}
 */
export async function keys() {
  if (isNative()) {
    return keysNative();
  } else {
    return keysWeb();
  }
}

// ============ 原生实现 ============

async function setItemNative(key, value) {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return setItemWeb(key, value);
    }
    await plugin.set({ key, value });
    return true;
  } catch (error) {
    console.error('安全存储写入失败:', error);
    // 降级到 localStorage
    return setItemWeb(key, value);
  }
}

async function getItemNative(key) {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return getItemWeb(key);
    }
    const result = await plugin.get({ key });
    return result.value;
  } catch (error) {
    // 键不存在时会抛出错误
    if (error.message?.includes('not found') || error.code === 'ERR_NO_VALUE') {
      return null;
    }
    console.error('安全存储读取失败:', error);
    // 降级到 localStorage
    return getItemWeb(key);
  }
}

async function removeItemNative(key) {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return removeItemWeb(key);
    }
    await plugin.remove({ key });
    return true;
  } catch (error) {
    console.error('安全存储删除失败:', error);
    return removeItemWeb(key);
  }
}

async function clearNative() {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return clearWeb();
    }
    await plugin.clear();
    return true;
  } catch (error) {
    console.error('安全存储清除失败:', error);
    return clearWeb();
  }
}

async function keysNative() {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return keysWeb();
    }
    const result = await plugin.keys();
    return result.keys || [];
  } catch (error) {
    console.error('获取安全存储键列表失败:', error);
    return keysWeb();
  }
}

// ============ Web 实现 ============

function setItemWeb(key, value) {
  try {
    localStorage.setItem(`secure_${key}`, value);
    return true;
  } catch (error) {
    console.error('localStorage 写入失败:', error);
    return false;
  }
}

function getItemWeb(key) {
  try {
    return localStorage.getItem(`secure_${key}`);
  } catch (error) {
    console.error('localStorage 读取失败:', error);
    return null;
  }
}

function removeItemWeb(key) {
  try {
    localStorage.removeItem(`secure_${key}`);
    return true;
  } catch (error) {
    console.error('localStorage 删除失败:', error);
    return false;
  }
}

function clearWeb() {
  try {
    // 只清除带前缀的键
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('secure_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    return true;
  } catch (error) {
    console.error('localStorage 清除失败:', error);
    return false;
  }
}

function keysWeb() {
  try {
    const result = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('secure_')) {
        result.push(key.replace('secure_', ''));
      }
    }
    return result;
  } catch (error) {
    console.error('获取 localStorage 键列表失败:', error);
    return [];
  }
}

// ============ 便捷方法 ============

/**
 * 存储 JSON 对象
 * @param {string} key - 键名
 * @param {any} value - 要存储的对象
 * @returns {Promise<boolean>}
 */
export async function setJSON(key, value) {
  try {
    const json = JSON.stringify(value);
    return await setItem(key, json);
  } catch (error) {
    console.error('JSON 序列化失败:', error);
    return false;
  }
}

/**
 * 获取 JSON 对象
 * @param {string} key - 键名
 * @returns {Promise<any|null>}
 */
export async function getJSON(key) {
  try {
    const json = await getItem(key);
    if (json === null) return null;
    return JSON.parse(json);
  } catch (error) {
    console.error('JSON 解析失败:', error);
    return null;
  }
}

// 默认导出
const secureStorage = {
  isNative,
  setItem,
  getItem,
  removeItem,
  clear,
  keys,
  setJSON,
  getJSON
};

export default secureStorage;
