# 壁纸管理功能说明

## 数据库设置

1. 创建名为 `wallpaper` 的数据库
2. 执行 `config/wallpaper.sql` 中的 SQL 语句创建表结构

```sql
-- 壁纸数据库表结构
CREATE TABLE wallpapers (
  id SERIAL PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 为 URL 添加索引以提高查询性能
CREATE INDEX idx_wallpapers_url ON wallpapers(url);
```

## 环境变量配置

在 `.env` 文件中配置数据库连接信息：

```env
# 壁纸数据库配置
WALLPAPER_DB_USER=your_db_user
WALLPAPER_DB_HOST=localhost
WALLPAPER_DB_NAME=wallpaper
WALLPAPER_DB_PASSWORD=your_db_password
WALLPAPER_DB_PORT=5432
```

如果未设置壁纸数据库的专门配置，系统会使用主数据库的配置。

## 功能使用

1. 启动应用后，访问 `/wallpapers` 路径
2. 在输入框中输入壁纸的 URL 地址并提交
3. 壁纸会显示在下方列表中
4. 可以删除不需要的壁纸