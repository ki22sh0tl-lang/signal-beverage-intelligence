# 饮品热点雷达研究与数据工具

先读 [网站分析与复刻方案.md](网站分析与复刻方案.md)。evidence/ 保存参考网站公开资源和提取的元信息，仅用于研究，不作为本站可再分发资产。

已安装 GitHub 开源项目 [PapaParse](https://github.com/mholt/PapaParse) 的 npm 包。工具生成我们自己的精简数据结构，不直接兼容参考站完整 schema。

## 使用

```powershell
rtk npm ci --ignore-scripts
rtk npm run check
rtk npm run demo
rtk npm run import -- "你的数据.csv" "output/report.json"
```

Excel 另存为 **CSV UTF-8**，参照 examples/notes.csv 的表头。每行一篇帖子，action_id 由业务复核确定，同一动作的多篇帖子使用相同 ID。modules 和 peripherals 多值用 `|` 分隔。

必需列：note_id、action_id、brand、action_name、title、published_date、likes、likes_captured_at、modules。日期格式 YYYY-MM-DD；指标截点采用带时区的 ISO 时间。示例为虚构数据。

输出包括 meta、summary、brandActions、notes。模块允许重叠，不能直接相加。主分类默认按联名 > 新品 > 活动选择，暂未提供人工主分类覆盖。多品牌联合动作需扩充模板后再使用，当前要求同一动作有一个一致品牌。

## 在线运行

```powershell
npm ci
npm start
```

- `/`：可被搜索引擎收录的项目首页
- `/app`：完整工作台（数据保存在当前浏览器）
- `/privacy`：数据与隐私说明
- `/healthz`：部署健康检查

仓库包含 `render.yaml`，可直接在 Render 通过 Blueprint 部署。部署后在扩展的“工作台连接”中填写公开地址和 Render 生成的 `CAPTURE_TOKEN`。
