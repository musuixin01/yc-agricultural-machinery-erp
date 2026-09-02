# PostgreSQL 备份与恢复方案调研

## 结论

玉春 ERP 的首版应用内备份采用 PostgreSQL `pg_dump` 自定义归档格式（`-Fc`），恢复使用 `pg_restore`。每份归档同时保存 SHA-256 指纹，并用 `pg_restore --list` 检查归档目录；只有两项均通过才标记为可恢复。

恢复仅接受本系统生成并留有元数据的可信备份。执行恢复前必须自动创建当前数据库快照；正式恢复使用 `--single-transaction --exit-on-error`，避免失败后留下部分恢复状态。覆盖恢复属于高风险操作，只授权经营者，并要求输入包含备份编号的确认文字。

## 官方依据

- PostgreSQL 官方说明，自定义格式默认压缩且可由 `pg_restore` 选择、重排和检查归档内容，适合作为应用级恢复点：[pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)。
- 官方 SQL Dump 文档给出了 `pg_dump -Fc` 与 `pg_restore` 的配套方式，并指出单库 `pg_dump` 不包含集群级角色和表空间：[SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)。
- `pg_restore --clean` 会删除待恢复对象，`--if-exists` 只减少不存在对象的噪声；恢复来源可执行来源超级用户选择的 SQL，因此不能接受未审查的任意外部归档：[pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)。

## 设计取舍

1. 不直接复制 Docker 数据卷。逻辑归档更易验证、下载和跨机器恢复，也不会把应用功能绑定到某个卷目录。
2. 首版只备份 `yc_erp` 业务数据库，不导出 PostgreSQL 集群角色和表空间。当前部署使用固定应用角色且不使用自定义表空间；若生产部署增加这些对象，需另加 `pg_dumpall --globals-only`。
3. 首版不允许上传任意外部 dump。官方明确指出恢复可能执行归档来源选择的 SQL；后续若开放导入，必须进入隔离数据库检查而不是直接恢复到正式库。
4. 应用内恢复会短暂断开数据库连接，操作员需通知其他员工暂停开单。多实例部署前必须增加分布式维护锁和流量摘除，不能沿用单进程内存锁。

## 验收边界

- “备份成功”表示：`pg_dump` 成功、归档目录可读取、文件 SHA-256 已记录。
- “自动测试通过”不等于生产恢复演练。仍须每月恢复到隔离数据库，并核对用户、商品、最近单据、库存、客户欠款和供应商欠款。
- 当前客户人像保存在 PostgreSQL 中，因此随数据库归档；另存到设备的票据图片和未来数据库外附件不包含。归档也不包含 `PII_ENCRYPTION_KEY`，密钥必须与数据库备份分开保管。

## 自动调度补充

- 当前单实例服务使用 Nest 生命周期启动和清理调度检查器；Nest 官方说明 `onModuleInit` 在依赖完成后调用，关闭钩子需配合正常应用关闭流程：[NestJS lifecycle events](https://docs.nestjs.com/fundamentals/lifecycle-events)。
- Node.js 官方说明定时器不保证在精确毫秒触发，因此系统保存“下一执行时间”并周期检查是否到期，而不是把一次 `setTimeout` 当作可靠持久任务；计时器使用 `unref()`，不阻止服务正常退出：[Node.js Timers](https://nodejs.org/api/timers.html)。
- 自动备份策略保存在备份目录的原子 JSON 文件中，独立于待恢复数据库，避免恢复旧数据库时意外恢复旧调度策略。首版面向单 API 实例；多实例部署前必须改用共享任务锁。
- 第二存储复制不直接把目标文件视为成功。Node.js 官方说明 `copyFile` 不保证原子性，因此先写入唯一临时文件、重新计算 SHA-256，再重命名为正式归档并写入元数据：[Node.js File system](https://nodejs.org/api/fs.html#fspromisescopyfilesrc-dest-mode)。
- 第二存储是本机恢复点的额外目录副本，不能替代离店备份或云端副本；目录必须由运行 API 的主机实际可写，并与主备份目录隔离。
