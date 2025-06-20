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
