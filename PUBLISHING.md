# 发布清单

发包前逐条打勾。每一步都能在本机复现，不需要 CI。

## 1. 本地校验

```powershell
cd D:\code\dsh-notify\dsh-desktop-toast
npm install            # 装 @deepseek-ai/schemastery + cosmokit（仅测试用）
npm test               # 24 个用例：事件分类 / 去重 / 静默期 / toast XML
node --check index.js
npm pack --dry-run     # 10 个文件，node_modules 不在里面
```

## 2. 在自己机器上真装一次

```powershell
dsh plugin --profile desktop add D:\code\dsh-notify\dsh-desktop-toast
```

重启 DSH 桌面端，随便发一条消息，应看到「任务完成」弹窗；让它问个问题，应看到「任务中断 · 需要你处理」。设置 → 插件里应出现「桌面通知」，配置项能改。

装坏了：

```powershell
dsh plugin --profile desktop remove dsh-desktop-toast
```

## 3. 补 published 元信息

`package.json` 里这三样发布前必须填真（现在留空，因为仓库地址还没定）：

```json
{
  "repository": { "type": "git", "url": "git+https://github.com/<你>/<repo>.git" },
  "homepage": "https://github.com/<你>/<repo>#readme",
  "author": "<你的名字> <邮箱>"
}
```

顺手把版本号语义化：首版 `0.1.0`；之后改行为 `0.2.0`，只修 bug `0.1.1`，改 `Config` 键名算破坏性变更 → 主版本。

## 4. 发到 npm

```powershell
npm login                     # 或 npm whoami 确认已登录
npm publish --access public   # publishConfig 里已写 access: public
npm view dsh-desktop-toast version
```

前提：`dsh-desktop-toast` 这个包名在 npm 上还空着（2026-10 查过是空的）。被占就改名，别硬发——DSH 市场按包名装。

## 5. 进插件市场（awesome-dsh-plugin）

市场索引是 `awesome-dsh-plugin` 仓库里的一个 YAML 文件，一个插件一个文件：

```
data/plugins/<owner>__<repo>.yml
```

```yaml
url: https://github.com/<owner>/<repo>
name: <owner>/<repo>
category: notify
description:
  en: Desktop notification when a DSH task is interrupted or finishes.
  zh: 任务中断或完成时弹系统桌面通知。
```

提 PR 之前确认：

- `package.json` 里有 `dsh.bundle.patch`（有，这点是市场最常见的打回原因）；
- 仓库里是能跑的代码，不是占位；
- **仓库创建满 1 天**（CI 自动查，PR 前几分钟建的仓库一定被拒）；
- 仓库加了 `dsh-plugin` topic；
- 描述只讲功能、不吹，且和代码对得上（评审会逐句核对）。

合并后 dshmarket / Discover 会从索引里搜到它，用户点一下就能装。

## 6. 之后怎么升级

改完代码 → `npm version patch|minor` → `npm publish` → 在 DSH 里删了重装（桌面端的包操作由 shell 负责，不能原地覆盖已装版本）。
