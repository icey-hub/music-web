# Music Web

一个基于 Next.js 构建的沉浸式 3D 音乐墙。专辑封面分布在可拖拽、带惯性的球形空间中，用户可以直接从卡片或底部播放器切换和播放音乐。

## 功能特性

- 全屏 3D 球形音乐卡片墙
- 鼠标与触控拖拽、惯性旋转和卡片聚焦效果
- 播放、暂停、上一首、下一首、进度跳转与音量控制
- 桌面端和移动端响应式布局
- 音频源不可用时自动尝试备用 Meting 接口
- 基于本地封面与视频资源呈现完整视觉效果

## 技术栈

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Lucide React

## 本地运行

环境要求：Node.js 18.17 或更高版本。

```bash
git clone https://github.com/icey-hub/music-web.git
cd music-web
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可访问。

## 可用命令

```bash
npm run dev    # 启动本地开发服务器
npm run check  # 执行 TypeScript 类型检查
npm run build  # 创建生产构建
npm run lint   # 执行代码检查
```

## 项目结构

```text
music-web/
├── public/              # 视频、封面和站点资源
├── scripts/             # 本地回归验证脚本
├── src/app/             # Next.js App Router 页面与全局样式
├── src/components/      # 音乐墙、卡片和播放器组件
├── src/data/            # 曲目数据
├── src/hooks/           # 音频播放逻辑
├── src/lib/             # 通用工具
└── src/types/           # TypeScript 类型定义
```

## 音频说明

曲目音频通过第三方 Meting 接口加载，实际可用性会受到接口状态、网络环境及浏览器自动播放策略影响。项目内的封面和视频资源用于页面展示。

## 致谢

页面交互与视觉设计参考 [Hanakos Music](https://forum.hanakos.cc/music)。本项目用于前端交互与视觉实现研究。
