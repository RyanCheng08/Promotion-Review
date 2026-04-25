# Promotion Review

手机复习用的晋升面试题卡。

## 本地同步模式

```bash
npm start
```

打开 `http://localhost:4173`。点击收藏或标记掌握后，进度会写入 `review-state.json`。服务运行期间会每 10 分钟把新的复习进度提交并推送到 GitHub。

如果手机和电脑在同一个局域网，可以用电脑的局域网 IP 访问，例如 `http://192.168.x.x:4173`，这样手机上的操作也会写到电脑上的 `review-state.json`。

Windows 下也可以双击 `start-local-sync.bat` 启动。

## GitHub Pages

仓库推送到 `main` 后，`.github/workflows/pages.yml` 会部署静态页面。GitHub Pages 页面本身是静态的，不能直接写本地文件或提交 GitHub；自动记录需要本地同步服务运行。
