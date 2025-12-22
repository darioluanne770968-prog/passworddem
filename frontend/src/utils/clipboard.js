/**
 * 剪贴板工具类
 * 支持 Web 和 Capacitor 原生 API
 */

import { Capacitor } from '@capacitor/core';
import { Clipboard as CapClipboard } from '@capacitor/clipboard';

// 自动清除定时器
let clearTimer = null;

/**
 * 检测是否为原生平台
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * 写入文本到剪贴板
 * @param {string} text - 要复制的文本
 * @param {number} autoClearSeconds - 自动清除时间（秒），0 表示不自动清除
 * @returns {Promise<boolean>}
 */
export async function writeText(text, autoClearSeconds = 30) {
  try {
    if (isNative()) {
      await CapClipboard.write({ string: text });
    } else {
      await navigator.clipboard.writeText(text);
    }

    // 设置自动清除
    if (autoClearSeconds > 0) {
      scheduleClean(autoClearSeconds);
    }

    return true;
  } catch (error) {
    console.error('剪贴板写入失败:', error);
    // 降级方案：使用 textarea
    return fallbackCopy(text);
  }
}

/**
 * 读取剪贴板文本
 * @returns {Promise<string>}
 */
export async function readText() {
  try {
    if (isNative()) {
      const result = await CapClipboard.read();
      return result.value || '';
    } else {
      return await navigator.clipboard.readText();
    }
  } catch (error) {
    console.error('剪贴板读取失败:', error);
    return '';
  }
}

/**
 * 清除剪贴板
 * @returns {Promise<boolean>}
 */
export async function clear() {
  try {
    if (isNative()) {
      await CapClipboard.write({ string: '' });
    } else {
      await navigator.clipboard.writeText('');
    }
    return true;
  } catch (error) {
    console.error('剪贴板清除失败:', error);
    return false;
  }
}

/**
 * 安排定时清除
 * @param {number} seconds - 延迟秒数
 */
function scheduleClean(seconds) {
  // 取消之前的定时器
  if (clearTimer) {
    clearTimeout(clearTimer);
  }

  clearTimer = setTimeout(async () => {
    await clear();
    clearTimer = null;
  }, seconds * 1000);
}

/**
 * 降级复制方案（使用 textarea）
 * @param {string} text
 * @returns {boolean}
 */
function fallbackCopy(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (error) {
    console.error('降级复制失败:', error);
    return false;
  }
}

// 默认导出
const clipboard = {
  writeText,
  readText,
  clear,
  isNative
};

export default clipboard;
