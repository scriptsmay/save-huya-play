# 项目概述 (Project Overview)

这是一个 Node.js 项目，主要用于自动化执行与虎牙（Huya）和斗鱼（Douyu）直播平台相关的任务。核心功能包括：

1.  **抓取直播回放**: 定期抓取指定虎牙主播的视频回放列表，并将数据存储到 PostgreSQL 数据库中。
2.  **自动签到与任务**: 使用 Puppeteer 控制浏览器，自动完成虎牙和斗鱼平台的每日签到、积分任务等。
3.  **粉丝徽章信息获取**: 抓取虎牙平台的粉丝徽章相关信息。
4.  **Web 服务**: 提供一个简单的 Web 界面，用于查看抓取到的视频列表、任务日志等。

项目依赖于 Puppeteer 进行浏览器自动化，使用 PostgreSQL 作为数据存储，并通过 Express 框架提供 Web 服务。

---

# 项目结构 (Project Structure)

```
.
├── README.md
├── package.json
├── ecosystem.config.js
├── .env.example
├── .gitignore
├── config/
│   ├── config.js        # 核心配置文件，包含 URL、选择器、用户列表等
│   ├── pg.js            # PostgreSQL 数据库连接池配置
│   ├── pg.sql           # 数据库表结构定义 (videos 表)
│   └── redis.js         # Redis 连接配置 (用于存储 cookies)
├── app/
│   ├── index.js         # Express 应用入口点
│   ├── router/
│   │   ├── html.js      # 处理 HTML 页面路由
│   │   └── api.js       # 处理 API 路由
│   └── views/           # EJS 模板文件
├── public/              # 静态资源文件 (CSS, JS)
├── scripts/             # 核心脚本目录
│   ├── save-huya-play.js     # 抓取虎牙回放视频列表并存入数据库
│   ├── huya-checkin.js       # 虎牙自动签到和任务
│   ├── douyu-checkin.js      # 斗鱼自动签到和任务
│   ├── huya-badgelist.js     # 获取虎牙粉丝徽章信息
│   ├── douyu-badgelist.js    # 获取斗鱼粉丝徽章信息 (可能未实现或为空)
│   ├── kpl-everyday.js       # KPL 相关每日任务 (可能未实现或为空)
│   ├── cleanup.js            # 数据清理脚本 (可能未实现或为空)
│   └── util/                 # 工具函数目录
│       ├── huyaUserService.js   # 虎牙用户登录状态检查
│       ├── douyuUserService.js  # 斗鱼用户登录状态检查 (可能未实现或为空)
│       ├── cookieService.js     # Cookie 管理 (加载/保存到 Redis)
│       ├── checkInService.js    # 签到服务逻辑 (可能未实现或为空)
│       ├── msgService.js        # 消息推送服务 (如推送到 QQ)
│       └── index.js             # 通用工具函数 (timeLog, sleep 等)
└── logs/                     # 日志文件目录 (由 morgan 生成)
```

---

# 核心技术栈 (Core Technologies)

*   **运行环境**: Node.js
*   **Web 框架**: Express.js
*   **模板引擎**: EJS
*   **数据库**: PostgreSQL (pg)
*   **缓存/会话**: Redis (redis)
*   **浏览器自动化**: Puppeteer
*   **HTTP 客户端**: Axios
*   **环境变量管理**: dotenv
*   **日志记录**: morgan
*   **进程管理**: PM2 (通过 ecosystem.config.js)

---

# 构建与运行 (Building and Running)

1.  **环境准备**:
    *   确保已安装 Node.js 和 npm。
    *   安装 PostgreSQL 数据库并创建相应的数据库。
    *   (可选) 安装 Redis 服务。
    *   复制 `.env.example` 为 `.env` 并配置数据库连接信息、端口等。

2.  **安装依赖**:
    ```bash
    npm install
    ```

3.  **数据库初始化**:
    *   根据 `config/pg.sql` 文件创建 `videos` 表。

4.  **运行服务**:
    *   **开发模式**:
        ```bash
        npm start
        # 或者
        node app/index.js
        ```
        访问 `http://localhost:3000` (默认端口) 查看 Web 界面。
    *   **生产模式 (PM2)**:
        ```bash
        npm run pm2
        # 或者
        pm2 start ecosystem.config.js
        ```

5.  **执行脚本任务**:
    *   **抓取虎牙回放**:
        ```bash
        node scripts/save-huya-play.js
        # 或者通过 npm script
        npm run save
        ```
    *   **虎牙签到/任务**:
        ```bash
        node scripts/huya-checkin.js
        # 或者通过 npm script
        npm run huya-checkin
        ```
    *   **斗鱼签到/任务**:
        ```bash
        node scripts/douyu-checkin.js
        # 或者通过 npm script
        npm run douyu-checkin
        ```
    *   **获取粉丝徽章**:
        ```bash
        node scripts/huya-badgelist.js
        node scripts/douyu-badgelist.js
        # 或者通过 npm script
        npm run badge
        ```
    *   **KPL 每日任务**:
        ```bash
        node scripts/kpl-everyday.js
        # 或者通过 npm script
        npm run kpl-everyday
        ```
    *   **数据清理**:
        ```bash
        node scripts/cleanup.js
        # 或者通过 npm script
        npm run cleanup
        ```

---

# 开发约定 (Development Conventions)

*   **配置管理**: 使用 `dotenv` 管理环境变量，敏感信息如数据库密码应存放在 `.env` 文件中，该文件不提交到版本控制。
*   **代码风格**: 项目中包含了 ESLint 配置 (`eslint.config.mjs`)，应遵循其定义的规则。
*   **脚本命名**: 脚本文件放置在 `scripts/` 目录下，功能相关的脚本可以放在子目录中。
*   **工具函数**: 通用的工具函数应放在 `scripts/util/` 目录下，以便复用。
*   **日志输出**: 使用 `scripts/util/index.js` 中的 `timeLog` 函数进行日志打印，以保持日志格式统一。
*   **数据库操作**: 使用 `config/pg.js` 导出的 `pool` 对象进行数据库操作。
*   **浏览器自动化**: 使用 Puppeteer 时，注意合理设置 `headless` 模式、超时时间和用户数据目录 (`user_data`) 以方便调试和保持会话。
*   **Cookie 管理**: 用户登录后的 Cookie 通过 `scripts/util/cookieService.js` 存储在 Redis 中，以实现会话持久化。
*   **消息通知**: 任务执行结果可以通过 `scripts/util/msgService.js` 发送到指定的 API (如 QQ 机器人)。