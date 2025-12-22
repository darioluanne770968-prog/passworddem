/**
 * 生物识别工具类
 * 支持 Web (WebAuthn) 和 Capacitor 原生 API (Face ID / Touch ID)
 */

import { Capacitor } from '@capacitor/core';

// 动态导入原生插件（避免 Web 端报错）
let NativeBiometric = null;

async function loadNativePlugin() {
  if (Capacitor.isNativePlatform() && !NativeBiometric) {
    try {
      const module = await import('@aparajita/capacitor-biometric-auth');
      NativeBiometric = module.BiometricAuth;
    } catch (e) {
      console.warn('原生生物识别插件加载失败:', e);
    }
  }
  return NativeBiometric;
}

/**
 * 生物识别类型枚举
 */
export const BiometricType = {
  NONE: 'none',
  FACE_ID: 'faceId',
  TOUCH_ID: 'touchId',
  FINGERPRINT: 'fingerprint',
  FACE: 'face',
  IRIS: 'iris',
  UNKNOWN: 'unknown'
};

/**
 * 检测是否为原生平台
 */
export function isNative() {
  return Capacitor.isNativePlatform();
}

/**
 * 检查生物识别是否可用
 * @returns {Promise<{available: boolean, type: string, reason?: string}>}
 */
export async function checkAvailability() {
  if (isNative()) {
    return checkNativeAvailability();
  } else {
    return checkWebAuthnAvailability();
  }
}

/**
 * 检查原生生物识别可用性
 */
async function checkNativeAvailability() {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return { available: false, type: BiometricType.NONE, reason: '插件未加载' };
    }

    const result = await plugin.checkBiometry();

    if (result.isAvailable) {
      let type = BiometricType.UNKNOWN;

      // 根据 biometryType 确定具体类型
      switch (result.biometryType) {
        case 1: // Face ID
          type = BiometricType.FACE_ID;
          break;
        case 2: // Touch ID
          type = BiometricType.TOUCH_ID;
          break;
        case 3: // Fingerprint (Android)
          type = BiometricType.FINGERPRINT;
          break;
        case 4: // Face (Android)
          type = BiometricType.FACE;
          break;
        case 5: // Iris
          type = BiometricType.IRIS;
          break;
      }

      return { available: true, type };
    } else {
      return {
        available: false,
        type: BiometricType.NONE,
        reason: result.reason || '生物识别不可用'
      };
    }
  } catch (error) {
    console.error('检查生物识别失败:', error);
    return { available: false, type: BiometricType.NONE, reason: error.message };
  }
}

/**
 * 检查 WebAuthn 可用性（Web 端）
 */
async function checkWebAuthnAvailability() {
  try {
    if (!window.PublicKeyCredential) {
      return { available: false, type: BiometricType.NONE, reason: '浏览器不支持 WebAuthn' };
    }

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    return {
      available,
      type: available ? BiometricType.UNKNOWN : BiometricType.NONE,
      reason: available ? undefined : '设备不支持平台验证器'
    };
  } catch (error) {
    return { available: false, type: BiometricType.NONE, reason: error.message };
  }
}

/**
 * 执行生物识别验证
 * @param {Object} options - 验证选项
 * @param {string} options.reason - 验证原因（显示给用户）
 * @param {string} options.title - 对话框标题
 * @param {string} options.subtitle - 对话框副标题
 * @param {string} options.cancelTitle - 取消按钮文本
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function authenticate(options = {}) {
  const {
    reason = '请验证您的身份以访问密码保险箱',
    title = '身份验证',
    subtitle = '',
    cancelTitle = '取消'
  } = options;

  if (isNative()) {
    return authenticateNative({ reason, title, subtitle, cancelTitle });
  } else {
    return authenticateWebAuthn({ reason });
  }
}

/**
 * 原生生物识别验证
 */
async function authenticateNative(options) {
  try {
    const plugin = await loadNativePlugin();
    if (!plugin) {
      return { success: false, error: '生物识别插件未加载' };
    }

    await plugin.authenticate({
      reason: options.reason,
      cancelTitle: options.cancelTitle,
      allowDeviceCredential: true, // 允许使用设备密码作为备选
      iosFallbackTitle: '使用密码',
      androidTitle: options.title,
      androidSubtitle: options.subtitle
    });

    return { success: true };
  } catch (error) {
    // 用户取消
    if (error.code === 'userCancel' || error.message?.includes('cancel')) {
      return { success: false, error: '用户取消' };
    }

    console.error('生物识别验证失败:', error);
    return { success: false, error: error.message || '验证失败' };
  }
}

/**
 * WebAuthn 验证（Web 端）
 * 注意：这需要先在服务器端注册凭证
 */
async function authenticateWebAuthn(options) {
  try {
    // 获取存储的凭证 ID
    const credentialId = localStorage.getItem('webauthn_credential_id');

    if (!credentialId) {
      return { success: false, error: '未找到已注册的凭证' };
    }

    const challenge = crypto.getRandomValues(new Uint8Array(32));

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
        allowCredentials: [{
          type: 'public-key',
          id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
          transports: ['internal']
        }]
      }
    });

    if (credential) {
      return { success: true };
    } else {
      return { success: false, error: '验证失败' };
    }
  } catch (error) {
    if (error.name === 'NotAllowedError') {
      return { success: false, error: '用户取消' };
    }
    console.error('WebAuthn 验证失败:', error);
    return { success: false, error: error.message || '验证失败' };
  }
}

/**
 * 获取生物识别类型的友好名称
 * @param {string} type - BiometricType 枚举值
 * @returns {string}
 */
export function getBiometricTypeName(type) {
  const names = {
    [BiometricType.FACE_ID]: 'Face ID',
    [BiometricType.TOUCH_ID]: 'Touch ID',
    [BiometricType.FINGERPRINT]: '指纹识别',
    [BiometricType.FACE]: '面部识别',
    [BiometricType.IRIS]: '虹膜识别',
    [BiometricType.UNKNOWN]: '生物识别',
    [BiometricType.NONE]: '无'
  };
  return names[type] || '生物识别';
}

// 默认导出
const biometric = {
  BiometricType,
  isNative,
  checkAvailability,
  authenticate,
  getBiometricTypeName
};

export default biometric;
