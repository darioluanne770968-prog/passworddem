#!/usr/bin/env node

/**
 * 密码保险箱 CLI 工具
 * 命令行访问密码、密钥和敏感数据
 */

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');
const Conf = require('conf');
const fetch = require('node-fetch');

const config = new Conf({ projectName: 'vault-cli' });
const program = new Command();

// API 基础URL
const API_URL = config.get('apiUrl') || 'http://localhost:3001/api';

// 辅助函数
async function api(endpoint, options = {}) {
  const token = config.get('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

function requireAuth() {
  if (!config.get('token')) {
    console.log(chalk.red('请先登录: vault login'));
    process.exit(1);
  }
}

// 版本信息
program
  .name('vault')
  .description('密码保险箱命令行工具')
  .version('1.0.0');

// 登录
program
  .command('login')
  .description('登录到密码保险箱')
  .option('-e, --email <email>', '邮箱地址')
  .option('-u, --url <url>', 'API 服务器地址')
  .action(async (options) => {
    try {
      if (options.url) {
        config.set('apiUrl', options.url);
      }

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'email',
          message: '邮箱:',
          default: options.email,
          validate: v => v.includes('@') || '请输入有效邮箱'
        },
        {
          type: 'password',
          name: 'password',
          message: '主密码:',
          mask: '*'
        }
      ]);

      const spinner = ora('正在登录...').start();

      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify(answers)
      });

      if (result.requires2FA) {
        spinner.stop();
        const { code } = await inquirer.prompt([
          {
            type: 'input',
            name: 'code',
            message: '2FA 验证码:'
          }
        ]);

        const twoFAResult = await api('/auth/verify-2fa', {
          method: 'POST',
          body: JSON.stringify({
            tempToken: result.tempToken,
            code
          })
        });

        config.set('token', twoFAResult.token);
        config.set('email', answers.email);
      } else {
        config.set('token', result.token);
        config.set('email', answers.email);
      }

      spinner.succeed(chalk.green('登录成功!'));
    } catch (error) {
      console.log(chalk.red(`登录失败: ${error.message}`));
    }
  });

// 登出
program
  .command('logout')
  .description('登出')
  .action(() => {
    config.delete('token');
    config.delete('email');
    console.log(chalk.green('已登出'));
  });

// 列出密码
program
  .command('list')
  .alias('ls')
  .description('列出所有密码')
  .option('-c, --category <category>', '按分类筛选')
  .option('-t, --tag <tag>', '按标签筛选')
  .option('-f, --favorite', '只显示收藏')
  .action(async (options) => {
    requireAuth();
    const spinner = ora('获取密码列表...').start();

    try {
      let url = '/vault?';
      if (options.category) url += `category=${options.category}&`;
      if (options.tag) url += `tag=${options.tag}&`;
      if (options.favorite) url += 'favorite=1&';

      const items = await api(url);
      spinner.stop();

      if (items.length === 0) {
        console.log(chalk.yellow('没有找到密码条目'));
        return;
      }

      console.log(chalk.bold('\n密码列表:\n'));

      items.forEach((item, index) => {
        const star = item.is_favorite ? chalk.yellow('★') : ' ';
        const category = chalk.gray(`[${item.category}]`);
        console.log(`  ${star} ${chalk.cyan(index + 1)}. ${item.title || '未命名'} ${category}`);
      });

      console.log(chalk.gray(`\n共 ${items.length} 条记录`));
    } catch (error) {
      spinner.fail(chalk.red(`获取失败: ${error.message}`));
    }
  });

// 获取密码
program
  .command('get <query>')
  .description('获取密码详情')
  .option('-c, --copy', '复制密码到剪贴板')
  .option('-s, --show', '显示密码')
  .action(async (query, options) => {
    requireAuth();
    const spinner = ora('搜索密码...').start();

    try {
      const items = await api('/vault');
      const found = items.find(
        item => item.title?.toLowerCase().includes(query.toLowerCase()) ||
                item.id === parseInt(query)
      );

      if (!found) {
        spinner.fail(chalk.red('未找到匹配的密码'));
        return;
      }

      spinner.succeed(`找到: ${found.title}`);

      // 解密数据（这里需要客户端密钥，简化展示）
      console.log(chalk.bold('\n密码详情:'));
      console.log(`  标题: ${chalk.cyan(found.title || '未命名')}`);
      console.log(`  分类: ${found.category}`);
      console.log(`  创建时间: ${found.created_at}`);
      console.log(`  加密数据: ${chalk.gray('[已加密]')}`);

      if (options.copy) {
        try {
          const clipboardy = require('clipboardy');
          clipboardy.writeSync('[加密数据需要在客户端解密]');
          console.log(chalk.green('\n已复制到剪贴板'));
        } catch (e) {
          console.log(chalk.yellow('\n剪贴板不可用'));
        }
      }
    } catch (error) {
      spinner.fail(chalk.red(`获取失败: ${error.message}`));
    }
  });

// SSH 密钥管理
program
  .command('ssh')
  .description('SSH 密钥管理')
  .addCommand(
    new Command('list')
      .description('列出 SSH 密钥')
      .action(async () => {
        requireAuth();
        try {
          const keys = await api('/keys?type=ssh');
          console.log(chalk.bold('\nSSH 密钥:\n'));
          keys.forEach((key, i) => {
            console.log(`  ${i + 1}. ${chalk.cyan(key.name)}`);
            if (key.fingerprint) console.log(`     指纹: ${chalk.gray(key.fingerprint)}`);
          });
        } catch (error) {
          console.log(chalk.red(`获取失败: ${error.message}`));
        }
      })
  )
  .addCommand(
    new Command('generate')
      .description('生成新的 SSH 密钥对')
      .option('-n, --name <name>', '密钥名称')
      .option('-t, --type <type>', '密钥类型 (ed25519/rsa)', 'ed25519')
      .action(async (options) => {
        requireAuth();
        const spinner = ora('生成密钥...').start();
        try {
          const result = await api('/keys/generate/ssh', {
            method: 'POST',
            body: JSON.stringify({
              name: options.name || 'SSH Key',
              type: options.type
            })
          });
          spinner.succeed('密钥生成成功');
          console.log(chalk.bold('\n公钥:\n'));
          console.log(chalk.gray(result.publicKey));
          console.log(chalk.bold('\n指纹:'), result.fingerprint);
          console.log(chalk.yellow('\n⚠️  私钥已显示，请妥善保存'));
        } catch (error) {
          spinner.fail(chalk.red(`生成失败: ${error.message}`));
        }
      })
  );

// API Token 管理
program
  .command('token')
  .description('API Token 管理')
  .addCommand(
    new Command('create')
      .description('创建 API Token')
      .option('-n, --name <name>', 'Token 名称')
      .option('-d, --days <days>', '有效天数', '30')
      .action(async (options) => {
        requireAuth();
        const spinner = ora('生成 Token...').start();
        try {
          const result = await api('/keys/generate/api-token', {
            method: 'POST',
            body: JSON.stringify({
              name: options.name || 'API Token',
              expires_in_days: parseInt(options.days)
            })
          });
          spinner.succeed('Token 生成成功');
          console.log(chalk.bold('\nAPI Token:\n'));
          console.log(chalk.cyan(result.token));
          console.log(chalk.yellow('\n⚠️  请妥善保存此 Token，它不会再次显示'));
        } catch (error) {
          spinner.fail(chalk.red(`生成失败: ${error.message}`));
        }
      })
  );

// 暗网监控
program
  .command('breach')
  .description('泄露检查')
  .addCommand(
    new Command('check')
      .description('检查账号是否泄露')
      .action(async () => {
        requireAuth();
        const spinner = ora('检查泄露...').start();
        try {
          const result = await api('/breach/check', { method: 'POST' });
          spinner.stop();

          console.log(chalk.bold('\n泄露检查结果:\n'));
          result.results.forEach(r => {
            const status = r.totalBreaches > 0
              ? chalk.red(`⚠️  发现 ${r.totalBreaches} 次泄露`)
              : chalk.green('✓ 未发现泄露');
            console.log(`  ${r.monitor} (${r.type}): ${status}`);
          });
        } catch (error) {
          spinner.fail(chalk.red(`检查失败: ${error.message}`));
        }
      })
  )
  .addCommand(
    new Command('add')
      .description('添加监控项')
      .argument('<type>', '类型 (email/phone/username)')
      .argument('<value>', '要监控的值')
      .action(async (type, value) => {
        requireAuth();
        const spinner = ora('添加监控...').start();
        try {
          await api('/breach/monitors', {
            method: 'POST',
            body: JSON.stringify({ type, value })
          });
          spinner.succeed('监控已添加');
        } catch (error) {
          spinner.fail(chalk.red(`添加失败: ${error.message}`));
        }
      })
  );

// 身份生成器
program
  .command('identity')
  .description('生成虚拟身份')
  .option('-l, --locale <locale>', '语言 (zh-CN/en-US)', 'zh-CN')
  .option('-s, --save', '保存身份')
  .action(async (options) => {
    requireAuth();
    const spinner = ora('生成身份...').start();
    try {
      const result = await api('/identity/generate', {
        method: 'POST',
        body: JSON.stringify({
          locale: options.locale,
          save: options.save
        })
      });
      spinner.succeed('身份已生成');

      console.log(chalk.bold('\n虚拟身份:\n'));
      console.log(`  姓名: ${chalk.cyan(result.name)}`);
      console.log(`  电话: ${result.phone}`);
      console.log(`  邮箱: ${result.email}`);
      console.log(`  地址: ${result.address}`);
      console.log(`  生日: ${result.birthDate}`);

      if (result.idNumber) {
        console.log(`  身份证: ${result.idNumber}`);
      }
      if (result.ssn) {
        console.log(`  SSN: ${result.ssn}`);
      }

      if (options.save) {
        console.log(chalk.green('\n✓ 身份已保存'));
      }
    } catch (error) {
      spinner.fail(chalk.red(`生成失败: ${error.message}`));
    }
  });

// 状态
program
  .command('status')
  .description('查看登录状态')
  .action(() => {
    const email = config.get('email');
    const token = config.get('token');

    if (token) {
      console.log(chalk.green(`✓ 已登录: ${email}`));
      console.log(`  API: ${config.get('apiUrl') || API_URL}`);
    } else {
      console.log(chalk.yellow('未登录'));
    }
  });

// 配置
program
  .command('config')
  .description('配置管理')
  .option('-s, --set <key=value>', '设置配置')
  .option('-g, --get <key>', '获取配置')
  .option('-l, --list', '列出所有配置')
  .action((options) => {
    if (options.set) {
      const [key, value] = options.set.split('=');
      config.set(key, value);
      console.log(chalk.green(`已设置 ${key}`));
    } else if (options.get) {
      console.log(config.get(options.get) || chalk.gray('(未设置)'));
    } else if (options.list) {
      console.log(chalk.bold('\n配置:\n'));
      console.log(`  apiUrl: ${config.get('apiUrl') || '(默认)'}`);
      console.log(`  email: ${config.get('email') || '(未登录)'}`);
    }
  });

program.parse();
