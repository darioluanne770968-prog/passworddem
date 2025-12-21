# 密码保险箱 CLI

命令行工具，让你在终端中快速访问密码和密钥。

## 安装

```bash
cd cli
npm install
npm link  # 全局安装
```

## 使用

### 登录

```bash
vault login
vault login -e your@email.com
vault login -u http://your-server.com/api
```

### 密码管理

```bash
# 列出所有密码
vault list
vault ls

# 按分类筛选
vault list -c login
vault list -c card

# 获取密码
vault get github
vault get 1 --copy
```

### SSH 密钥管理

```bash
# 列出 SSH 密钥
vault ssh list

# 生成新密钥
vault ssh generate
vault ssh generate -n "My Server Key" -t rsa
```

### API Token 管理

```bash
# 创建 Token
vault token create
vault token create -n "CI/CD" -d 90
```

### 泄露检查

```bash
# 检查所有监控项
vault breach check

# 添加监控
vault breach add email your@email.com
vault breach add phone 13800138000
```

### 身份生成器

```bash
# 生成中文身份
vault identity

# 生成英文身份
vault identity -l en-US

# 生成并保存
vault identity --save
```

### 其他命令

```bash
# 查看状态
vault status

# 登出
vault logout

# 配置
vault config --list
vault config --set apiUrl=http://localhost:3001/api
```

## 快捷命令示例

```bash
# 快速获取 GitHub Token 并复制
vault get github --copy

# 检查泄露并查看结果
vault breach check

# 生成 SSH 密钥用于新服务器
vault ssh generate -n "Production Server"
```

## 注意事项

- 密码数据在本地解密，需要主密码
- CLI 配置存储在用户目录下
- 敏感操作需要重新验证身份
