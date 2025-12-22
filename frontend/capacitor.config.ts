import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.passwordvault.app',
  appName: 'Password Vault',
  webDir: 'dist',

  // iOS 配置
  ios: {
    scheme: 'Password Vault',
    // 允许混合内容（开发时可能需要）
    allowsLinkPreview: false,
    // 启用文本缩放
    preferredContentMode: 'mobile'
  },

  // 插件配置
  plugins: {
    // 状态栏配置
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a2e'
    },

    // 键盘配置
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },

    // 启动屏幕配置
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1a1a2e',
      showSpinner: true,
      spinnerColor: '#6366f1'
    },

    // 安全存储配置（iOS Keychain）
    SecureStoragePlugin: {
      keychainAccessGroup: undefined // 如需应用组共享可配置
    }
  },

  // 服务器配置（生产环境使用本地文件）
  server: {
    // 开发时可取消注释以连接本地服务器
    // url: 'http://localhost:5174',
    // cleartext: true
  }
};

export default config;
