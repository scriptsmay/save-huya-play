const DEFAULT_ERR_HTML = `
  <html>
    <head>
      <title>服务器错误</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
        h1 { color: red; }
      </style>
      <meta http-equiv="refresh" content="2;url=/">
    </head>
    <body>
      <h1>🛠️ 无法处理该请求，服务器内部错误 🛠️</h1>
      <p>页面将在 2 秒后跳转...</p>
    </body>
  </html>
`;

const LOG_ERR_HTML = `
  <html>
    <head>
      <title>服务器错误</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
        h1 { color: red; }
      </style>
      <meta http-equiv="refresh" content="2;url=/logs">
    </head>
    <body>
      <h1>无法处理日志文件请求，服务器内部错误 🛠️</h1>
      <p>页面将在 2 秒后跳转...</p>
    </body>
  </html>
`;

module.exports = {
  LOG_ERR_HTML,
};
