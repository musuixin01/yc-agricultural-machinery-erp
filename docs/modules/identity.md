# 身份认证与权限模块

## 已实现范围

- 系统无用户时的一次性经营者账号初始化；
- 用户名和密码登录，连续 5 次失败锁定 15 分钟；
- 15 分钟访问令牌、30 天刷新令牌及刷新令牌轮换；
- 当前用户查询、主动注销和服务端会话撤销；
- 用户、角色、权限、会话和只追加认证审计的数据模型；
- Catalog、Parties、Warehouses API 的服务端读写权限校验；
- A 桌面端和 C 手机端首次初始化、登录和退出界面。
- 经营者新增员工、按预置岗位分配权限、启停账号；
- 经营者重置员工密码、撤销员工全部设备会话；
- 销售、采购、仓管、财务/记账四个不可冒充经营者的员工岗位；
- 认证写操作的成功/失败审计，以及按结果查询审计记录；
- A 桌面端和 C 手机端员工账号与操作审计界面。

经营者角色获得全部已登记权限。库存、采购、销售、应收应付、资金、经营看板、系统参数和数据备份恢复均已接入服务端权限。

## 安全约束

- 密码不保存明文，使用带独立随机盐的 scrypt 派生值；参数为 `N=2^17, r=8, p=1`。
- 会话令牌由密码学安全随机源产生，数据库只保存 SHA-256 摘要。
- 刷新成功后旧刷新令牌立即失效；注销后服务端会话不可继续使用。
- 登录失败使用统一提示，不向调用方确认用户名是否存在。
- 浏览器开发预览只使用 `sessionStorage`；正式 Tauri 客户端必须接入系统安全存储后才能作为生产交付。
- 界面隐藏不等于授权，所有受保护 API 均由认证和权限守卫判断。

## 接口

- `GET /api/v1/auth/bootstrap-status`
- `POST /api/v1/auth/bootstrap-owner`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET /api/v1/identity/roles`
- `GET/POST /api/v1/identity/users`
- `PATCH /api/v1/identity/users/:id/status`
- `POST /api/v1/identity/users/:id/reset-password`
- `POST /api/v1/identity/users/:id/revoke-sessions`
- `GET /api/v1/identity/audit-events`

## 尚未实现

- 自助修改密码与经营者编辑员工的岗位组合；
- 多因素认证、生产 HTTPS/Cookie 或 Tauri 安全存储；
- 审计导出、保留策略、变更前后值与追踪编号；
- 按门店/仓库限制数据范围。

当前通用审计适用于基础资料和账号管理。库存、采购、销售及供应商付款的正式过账审计已经与业务单据和账本写入处于同一个数据库事务；后续客户收款也必须保持同一约束。
