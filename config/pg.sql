
-- sql建表
CREATE TABLE videos (
  id SERIAL PRIMARY KEY,
  url VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  duration VARCHAR(255),  -- 单位：秒
  cover VARCHAR(255),     -- 封面图 URL
  date VARCHAR(255),      -- 视频发布日期
  created_at TIMESTAMP DEFAULT NOW()  -- 数据插入时间
);