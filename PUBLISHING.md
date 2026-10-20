# 发布清单

发包前逐条打勾。每一步都能在本机复现，不需要 CI。

## 1. 本地校验

```powershell
cd D:\code\dsh-notify\dsh-desktop-toast
npm install            # 装 @deepseek-ai/schemastery + cosmokit（仅测试用）
npm test               # 24 个用例：事件分类 / 去重 / 静默期 / toast XML
node --check index.js
npm pack --dry-run     # 12 个文件，node_modules / test 不在里面
```

## 2. 在自己机器上真装一次

```powershell
dsh plugin --profile desktop add D:\code\dsh-notify\dsh-desktop-toast
```

重启 DSH 桌面端，随便发一条消息，应看到「任务完成」弹窗；让它问个问题，应看到「任务中断 · 需要你处理」。设置 → 插件里应出现「桌面通知」及其描述（配置项不在页面里改，见 README「配置」）。

装坏了：

```powershell
dsh plugin --profile desktop remove dsh-desktop-toast
```

## 3. 发布元信息

`repository` / `homepage` / `bugs` / `author` / `license` / `icon` / `dsh.bundle.patch` / `engines.node` 都已填好，配着 GitHub 仓库 `hhaosheng/dsh-desktop-toast` 一致；换仓库地址时要同步改这几处，否则 DSH 的「已安装」列表会链到旧地址。

版本号语义化：首版 `0.1.0`；之后改行为 `0.2.0`，只修 bug `0.1.1`，改 `Config` 键名算破坏性变更 → 主版本。

## 4. 发到 npm

**registry 必须显式指定。** 本机 `~/.npmrc` 默认指向 `registry.npmmirror.com`（只读镜像，发不上去），所以每条发布命令都要带 `--registry https://registry.npmjs.org/`。

**账号开了 2FA（`auth-and-writes`）**，命令行发布需要一次性验证码。两种办法：

- 临时：`npm publish --registry https://registry.npmjs.org/ --access public --otp=<6 位码>`
- 长期（推荐）：在 <https://www.npmjs.com/settings/huanghaosheng/tokens> 建一个 **Granular Access Token**，权限 *Read and write*、范围 *All packages*、勾选 **bypass 2FA**、不设 IP 白名单。发布时：

```powershell
cd D:\code\dsh-notify\dsh-desktop-toast
Set-Content -NoNewline .npmrc '//registry.npmjs.org/:_authToken=npm_你的token'
npm publish --registry https://registry.npmjs.org/ --userconfig .npmrc --access public
```

`.npmrc` 已在 `.gitignore` 里，不会进仓库；它也不在 `files` 列表里，不会进发布包。token 过期就重签一个。

发布后核对：

```powershell
npm view dsh-desktop-toast version dist.tarball --registry https://registry.npmjs.org/
```

预期 `0.1.0` 和 `https://registry.npmjs.org/dsh-desktop-toast/-/dsh-desktop-toast-0.1.0.tgz`。

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
