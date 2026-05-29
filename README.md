# 街斗生成器

一个可在手机浏览器玩的横版 2D 格斗小游戏。角色素材由网页脚本自动生成，不依赖外部图片或构建工具。

## GitHub Pages 发布

1. 在 GitHub 新建一个公开仓库，例如 `street-fighter-generator`。
2. 上传这些文件到仓库根目录：
   - `index.html`
   - `styles.css`
   - `game.js`
   - `.nojekyll`
3. 打开仓库的 `Settings` -> `Pages`。
4. 在 `Build and deployment` 里选择 `Deploy from a branch`。
5. Branch 选择 `main`，Folder 选择 `/root`，然后保存。
6. 等待 GitHub 生成访问地址，通常是：

```text
https://你的用户名.github.io/street-fighter-generator/
```

发布后，任何网络下的手机都可以打开这个 HTTPS 地址游玩。

## 本地预览

```bash
python3 -m http.server 8794
```

然后访问：

```text
http://127.0.0.1:8794/
```
