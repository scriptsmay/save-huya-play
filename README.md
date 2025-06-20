# save-huya-play

## Dev

```
# 配置 .env 文件
cp .env.example .env

# 安装依赖
npm i
```

## Run Database

配置 `config/config.js` 中的指定页面

```
npm test
```

## Run Server

```
npm start
```

Visit: http://localhost:3210

## PM2 Run

```sh
npm run pm2
# or
pm2 start ecosystem.config.js
```

其他命令：

```sh
# 停止配置文件中的所有进程
pm2 stop ecosystem.config.js

# 完全删除配置文件相关的所有进程
pm2 delete ecosystem.config.js

# 先查看所有运行中的应用
pm2 list

# 然后按配置文件中的应用名称停止
pm2 stop app1 app2 app3

# 或者删除应用
pm2 delete app1 app2 app3
```
