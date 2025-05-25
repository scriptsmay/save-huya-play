
部署数据可视化

```shell
# 使用 Docker 快速启动（需提前安装 Docker）
docker run -d \
  -p 18055:8055 \
  -e DB_CLIENT="pg" \
  -e DB_HOST="192.168.31.18" \
  -e DB_PORT="15432" \
  -e DB_DATABASE="directus" \
  -e DB_USER="user_2hPFjc" \
  -e DB_PASSWORD="password_QWr6wQ" \
  -e SECRET=replace-with-secure-random-value \
  directus/directus

docker run -d \
  -p 8055:8055 \
  -e SECRET=replace-with-secure-random-value \
  directus/directus
```


重置密码：

```shell

# 进入 Directus 容器
docker exec -it directus sh

# 执行密码重置命令
```

[11:59:25.052] INFO: No admin email provided. Defaulting to "admin@example.com"
[11:59:25.053] INFO: No admin password provided. Defaulting to "f57wV_oHA2IK"

nvm install