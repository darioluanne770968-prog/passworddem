import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Capacitor 需要相对路径
  base: '',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '密码保险箱',
        short_name: 'Vault',
        description: '安全的密码管理工具 - 端到端加密保护您的所有密码',
        theme_color: '#0052CC',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'zh-CN',
        dir: 'ltr',
        categories: ['productivity', 'security', 'utilities'],
        shortcuts: [
          {
            name: '添加新密码',
            short_name: '添加',
            description: '快速添加新密码',
            url: '/add',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: '密码生成器',
            short_name: '生成',
            description: '生成强密码',
            url: '/generator',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          },
          {
            name: '安全检查',
            short_name: '安全',
            description: '检查密码安全性',
            url: '/security',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }]
          }
        ],
        icons: [
          {
            src: '/icon-72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: '/icon-96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: '/icon-128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: '/icon-144.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: '/icon-152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshots/vault.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: '密码保险箱主界面'
          },
          {
            src: '/screenshots/mobile.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: '移动端界面'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,eot}'],
        // 离线页面
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // 运行时缓存策略
        runtimeCaching: [
          {
            // API 请求 - 网络优先，失败后使用缓存
            urlPattern: /^.*\/api\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24小时
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // 静态资源 - 缓存优先
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
              }
            }
          },
          {
            // 字体文件 - 缓存优先
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
              }
            }
          },
          {
            // Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets'
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
              }
            }
          }
        ],
        // 跳过等待，立即激活新 Service Worker
        skipWaiting: true,
        clientsClaim: true
      },
      // 开发环境也启用
      devOptions: {
        enabled: false // 开发时禁用，避免缓存问题
      }
    })
  ],
  // 构建优化
  build: {
    // 代码分割
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'crypto': ['./src/utils/crypto.js']
        }
      }
    },
    // 压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // 源码映射（生产环境禁用）
    sourcemap: false,
    // 资源内联阈值
    assetsInlineLimit: 4096
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
