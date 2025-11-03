-- 为现有表添加唯一约束
-- ALTER TABLE videos ADD CONSTRAINT videos_url_unique UNIQUE (url);

-- 或者如果你可以重新建表，使用这个创建语句：
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  url VARCHAR(255) NOT NULL UNIQUE,  -- 视频 URL，添加唯一约束
  username VARCHAR(255),  -- 上传者用户名
  title VARCHAR(255),     -- 视频标题
  duration VARCHAR(255),  -- 单位：秒
  cover VARCHAR(255),     -- 封面图 URL
  date VARCHAR(255),      -- 视频发布日期
  created_at TIMESTAMP DEFAULT NOW()  -- 数据插入时间
);
