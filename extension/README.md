# Signal 采集助手

1. 打开 Chrome 或 Edge 的扩展管理页（chrome://extensions/ 或 edge://extensions/），启用开发者模式。
2. 选择“加载已解压的扩展程序”，加载本目录。
3. 保持 Signal 工作台运行，打开一篇小红书笔记。
4. 点击扩展图标打开常驻侧边栏；打开笔记后点击“采集当前页”才会加入本地队列。
5. 在侧边栏选择“同步到工作台”或“导出 CSV”；也可以删除单条或清空队列。
6. 如果使用线上工作台，展开“工作台连接”，填入公开 HTTPS 地址和 Render 环境变量 `CAPTURE_TOKEN`，保存后再同步。

扩展只读取当前页面可见字段，并发送到你在“工作台连接”中配置的地址（默认是 http://127.0.0.1:4173）。它不读取或传输 Cookie。若扩展页面提示 sidePanel 不支持，请升级 Chrome/Edge 到支持 Manifest V3 Side Panel 的版本。
