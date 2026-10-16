# 小橘历

小橘历是一个本地运行的自然语言日程助手。用聊天描述安排，先检查并确认，再写入 Apple Calendar 或 Apple Reminders。

## 在自己的电脑上运行

### 需要什么

- Node.js 20.9 或更高版本
- 想直接读写 Apple Calendar / Reminders：需要 macOS 和本机的 Calendar、Reminders 应用
- DeepSeek API 密钥是可选的。内置示例指令可离线解析；其他自由表达需要自行配置模型密钥

Windows 和 Linux 可以运行网页并使用模拟桥接体验界面，但无法通过 Apple 的本地自动化接口写入日历。Apple 日历写入无需部署到 Vercel 或其他服务器。

### 安装和启动

打开终端，依次运行：

```bash
git clone https://github.com/Sisidaier/life-layer.git
cd life-layer
npm install
cp .env.example .env.local
npm run dev
```

然后在浏览器打开 <http://localhost:3000>。

默认桥接为 `mock`，可先体验解析和确认流程，不会修改日历。若要在 macOS 上写入真实日历，先停止开发服务，在 `.env.local` 中将：

```dotenv
LIFE_LAYER_BRIDGE=mock
```

改为：

```dotenv
LIFE_LAYER_BRIDGE=applescript
```

保存后重新运行 `npm run dev`。首次写入时，macOS 会询问是否允许运行环境控制 Calendar 或 Reminders；允许后，确认卡片中的操作才会写入。

可以用这句话验证 Golden Path：

```text
明天下班后 7 点去游泳。
```

它会生成 60 分钟的日历安排。确认后才会写入。

## 可选：启用 DeepSeek

在 `.env.local` 中填写你自己的密钥：

```dotenv
LIFE_LAYER_AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=填入你自己的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

随后重启 `npm run dev`。密钥只放在本机的 `.env.local`，不要放进源码、截图或 `NEXT_PUBLIC_` 变量。每位使用者都需要使用自己的 DeepSeek 账号和密钥。

## 数据和隐私

- `.env.local` 保存本机配置，并由 Git 忽略
- 操作历史保存在本机浏览器；本地桥接的待处理数据保存在 `.data/`，也由 Git 忽略
- 使用 DeepSeek 时，用户发来的指令会发送给该 API 用于解析
- 页面不会在未经确认时执行日历写入

## iPhone 使用

可以在 iPhone Safari 中打开网页并添加到主屏幕。普通网页/PWA 无法直接取得 EventKit 权限；当前日历写入桥面向 macOS 本机运行。手机原生日历接入暂未实现。详见 [iPhone PWA 指南](docs/IPHONE_PWA.md)。

## 项目文档

- [架构和项目范围](docs/ARCHITECTURE.md)
- [结构化操作数据格式](docs/ACTION_SCHEMA.md)
- [iPhone PWA 使用路径](docs/IPHONE_PWA.md)

## 开源许可

本项目以 MIT License 发布，详见 [LICENSE](LICENSE)。
