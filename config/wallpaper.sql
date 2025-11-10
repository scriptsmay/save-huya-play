-- 壁纸数据库表结构
CREATE TABLE wallpapers (
  id SERIAL PRIMARY KEY,
  url VARCHAR(500) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 为 URL 添加索引以提高查询性能
CREATE INDEX idx_wallpapers_url ON wallpapers(url);