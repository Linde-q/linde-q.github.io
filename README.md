# 🐰 背单词小助手(网页版)

桌面版 app.py 的网页移植: 功能一样(随机/英→中/中→英 抽背、章节范围、宽松判分、
错题本连续答对 5 次自动移出), 但不用装东西, 手机也能用。

## 文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 页面本体(界面 + 交互) |
| `quiz.js` | 核心逻辑: 词库解析、判分、错题本、选项存储(和 app.py 一致) |
| `words.js` | 词库数据(由 `words.txt` 生成) |
| `build_words.py` | 把 `words.txt` 转成 `words.js`, 词库更新后重跑一次 |
| `selftest.js` | `node selftest.js` 跑一遍解析/判分/错题本的用例 |

## 上线情况

已经挂在站点根目录: <https://linde-q.github.io/>

- 仓库 `Linde-q/linde-q.github.io` 根目录放的就是 `index.html` + `quiz.js` + `words.js`
  (Pages: `main` 分支 `/ (root)`)
- 原来的主页(学生端 / 教师端那个 Quiz App)保留成 `index-old.html`, 它的 `css/ js/ html/ image/` 都没动
- `beidanci/` 现在只剩一个跳转到主页的小页面, 以免之前分享过的链接失效

### 更新流程

1. 改这一层(或仓库里)的 `index.html` / `quiz.js` / `words.js`
2. 词库有更新时先跑 `python build_words.py` 重新生成 `words.js`
3. 把这三个文件复制到仓库根目录, commit + push, GitHub Pages 一两分钟自动生效

## 本地先看看

直接双击 `index.html` 就能用; 或者在 `web/` 目录里跑 `python -m http.server 8765`,
然后打开 <http://localhost:8765/>。

## 更新词库

在 `web/` 目录里跑:

```bash
python build_words.py            # 自动找上一层的 words.txt
python build_words.py 别的词库.txt  # 或指定文件
```

生成新的 `words.js` 后一起 push 即可。也可以不改代码, 直接在网页上点
「📥 换一份词库文件」导入(格式和 `words.txt` 一样: 章节标题行 + Tab 分隔的「英文 中文」),
导入的词库会存在那台设备的浏览器里, 点「♻️ 恢复内置词库」可以还原。

## 说明

- 全部逻辑都在浏览器里跑, 没有后端、没有上传。
- 选项和错题本存在浏览器 localStorage 里, 换设备/清缓存就没了(这也正是桌面版两个
  bug 的根源之一: 桌面版选项不保存, 错题本又存不下来)。
- `index.html` 里显示「本轮范围」(例如 `📖 只看错题（3 词）`), 免得出现"怎么只有一个词"的疑惑。
- ⚠️ 如果站点仓库是公开的, 词库内容(PCB 术语中英对照)也就是公开的, 分享前先确认下。
