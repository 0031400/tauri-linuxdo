# FluxDO API Inventory

本文档整理 `thirdparty/fluxdo` 中已确认使用的 API，按域名和功能分组，并补充请求与响应格式。

约束:
- 仅记录源码中已确认的调用与字段。
- 响应格式只列出 FluxDO 实际解析或显式依赖的字段，不等于服务端完整返回。
- 对于变量拼接的路径，只写能从源码确认的格式。

## 1. 基础域名

### 1.1 主站

- Base URL: `https://linux.do`
- 来源:
  - `thirdparty/fluxdo/lib/constants.dart`
  - `thirdparty/fluxdo/lib/services/network/discourse_dio.dart`

### 1.2 相关子站

- `https://credit.linux.do`
- `https://connect.linux.do`
- `https://ping.linux.do`（长轮询独立域名，来自站点配置）
- `https://cdn.linux.do`
- `https://cdn3.linux.do`

## 2. 鉴权与会话

### 2.1 获取 CSRF

- Method: `GET`
- Path: `/session/csrf`
- 作用: 获取非 GET 请求所需的 `X-CSRF-Token`
- 来源:
  - `thirdparty/fluxdo/lib/services/network/cookie/csrf_token_service.dart`

请求格式:
```http
GET /session/csrf HTTP/1.1
Host: linux.do
```

响应格式:
```json
{
  "csrf": "string"
}
```

### 2.2 当前登录用户

- Method: `GET`
- Path: `/session/current.json`
- 作用: 判断是否已登录，并返回当前用户
- 来源:
  - `thirdparty/fluxdo/lib/models/user.dart`

请求格式:
```http
GET /session/current.json HTTP/1.1
Host: linux.do
Cookie: _t=...
```

响应格式: FluxDO 已确认依赖 `current_user`
```json
{
  "current_user": {
    "id": 123,
    "username": "string"
  }
}
```

说明:
- `current_user == null` 会被视为未登录。
- `User.fromJson(...)` 会继续解析更多用户字段，但本次仅写当前已明确确认的入口格式。

### 2.3 登出会话

- Method: `DELETE`
- Path: `/session/{username}`
- 来源:
  - `thirdparty/fluxdo/lib/services/discourse/_auth.dart`

请求格式:
```http
DELETE /session/{username} HTTP/1.1
Host: linux.do
X-CSRF-Token: ...
Cookie: _t=...
```

响应格式:
- 源码未显式解析响应体

## 3. 通知 / Message List

### 3.1 最近通知

- Method: `GET`
- Path: `/notifications`
- Query:
  - `recent=true`
  - `limit=30`
  - `bump_last_seen_reviewable=true`
- 来源:
  - `thirdparty/fluxdo/lib/services/discourse/_notifications.dart`

请求格式:
```http
GET /notifications?recent=true&limit=30&bump_last_seen_reviewable=true HTTP/1.1
Host: linux.do
Cookie: _t=...
```

响应格式:
```json
{
  "notifications": [
    {
      "id": 1,
      "user_id": 123,
      "notification_type": 2,
      "read": false,
      "high_priority": false,
      "created_at": "2026-04-08T10:00:00.000Z",
      "post_number": 1,
      "topic_id": 100,
      "slug": "topic-slug",
      "fancy_title": "string",
      "acting_user_avatar_template": "/user_avatar/linux.do/name/{size}/1.png",
      "data": {
        "display_username": "string",
        "original_post_id": "1",
        "original_post_type": 1,
        "original_username": "string",
        "revision_number": 1,
        "topic_title": "string",
        "badge_name": "string",
        "badge_id": 1,
        "badge_slug": "string",
        "group_name": "string",
        "inbox_count": "2",
        "count": 3,
        "username": "string",
        "username2": "string",
        "acting_user_avatar_template": "/user_avatar/linux.do/name/{size}/1.png",
        "avatar_template": "/user_avatar/linux.do/name/{size}/1.png"
      }
    }
  ],
  "total_rows_notifications": 10,
  "seen_notification_id": 100,
  "load_more_notifications": "/notifications?offset=60"
}
```

已确认字段来源:
- `thirdparty/fluxdo/lib/models/notification.dart`

### 3.2 通知列表分页

- Method: `GET`
- Path: `/notifications`
- Query:
  - `limit=60`
  - `offset={offset}` 可选
- 来源:
  - `thirdparty/fluxdo/lib/services/discourse/_notifications.dart`

请求格式:
```http
GET /notifications?limit=60&offset=60 HTTP/1.1
Host: linux.do
Cookie: _t=...
```

响应格式:
- 与 3.1 相同

### 3.3 标记全部已读

- Method: `PUT`
- Path: `/notifications/mark-read`
- 来源:
  - `thirdparty/fluxdo/lib/services/discourse/_notifications.dart`

请求格式:
```http
PUT /notifications/mark-read HTTP/1.1
Host: linux.do
X-CSRF-Token: ...
Cookie: _t=...
Content-Type: application/json
```

响应格式:
- 源码未显式解析响应体

### 3.4 标记单条已读

- Method: `PUT`
- Path: `/notifications/mark-read`
- Body:
```json
{
  "id": 123
}
```
- 来源:
  - `thirdparty/fluxdo/lib/services/discourse/_notifications.dart`

响应格式:
- 源码未显式解析响应体

## 4. MessageBus / 实时消息

### 4.1 长轮询

- Method: `GET` 或 `POST`
- Path: `/message-bus/{clientId}/poll`
- 来源:
  - `thirdparty/fluxdo/lib/services/message_bus_service.dart`
  - `thirdparty/fluxdo/lib/services/background/ios_background_fetch.dart`

已确认两种调用方式:

方式 A: 前台轮询
- 路径: `/message-bus/{clientId}/poll`
- 代码中会带频道与 last message id 相关参数

方式 B: iOS 后台轮询
- 路径: `/message-bus/{clientId}/poll`
- Body 形如:
```json
{
  "/some/channel": "123"
}
```

响应格式:
```json
[
  {
    "channel": "/some/channel",
    "message_id": 456,
    "data": {}
  }
]
```

已确认字段来源:
- `thirdparty/fluxdo/lib/services/message_bus_service.dart`

### 4.2 Presence

- `POST /discourse-presence/get-presence`
- `GET /presence/get`
- `POST /presence/update`
- 已确认订阅频道:
  - `channels[]=/discourse-presence/reply/{topicId}`
- 来源:
  - `thirdparty/fluxdo/lib/services/discourse/_presence.dart`

请求/响应格式:
- 源码能确认接口路径和部分 query/body 键名
- 但未看到完整模型定义，暂不伪造完整结构

## 5. 主题 / Topic

来源:
- `thirdparty/fluxdo/lib/services/discourse/_topics.dart`

### 5.1 主题详情

- `GET /t/{topicId}/1.json`
- `GET /t/{slug}.json`
- `GET /t/{slug}/{postNumber}.json`

请求格式:
```http
GET /t/topic-slug/123.json HTTP/1.1
Host: linux.do
```

响应格式:
- FluxDO 会解析为 `TopicDetail`
- 当前文档不展开完整字段，后续可单独补 `TopicDetail` 模型

### 5.2 主题列表

已确认存在以下列表类接口:
- `GET /top.json`
- `GET /c/{categorySlug}.json`
- 以及通过变量 path 调用的列表接口，例如 `latest/new/unread/tag` 等

### 5.3 分类列表（Tauri 使用）

来源:
- `src/api/linuxdo.ts`

已确认接口:
- `GET /categories.json`
- `GET /categories.json?parent_category_id={parentCategoryId}`

当前 Tauri 项目已使用字段（仅列出实际读取）:
- `category_list.categories[].id`
- `category_list.categories[].name`
- `category_list.categories[].slug`
- `category_list.categories[].parent_category_id`

说明:
- 应用启动后会先请求 `GET /categories.json`，再按父分类批量请求 `GET /categories.json?parent_category_id={id}`，合并为全量分类缓存。
- 左侧“等级筛选”基于全量缓存中名称/slug 包含 `LvN` 的子分类动态生成（如 `Lv1`、`Lv2`）。
- 话题列表按分类请求支持多段路径：`/c/{parentSlug}/{childSlug}/l/latest.json`（例如 `/c/wiki/wiki-lv2/l/latest.json`）。
- 返回中其余字段（例如 `topics`、`description`、`subcategory_ids`）当前未在项目代码中使用。

### 5.4 创建与修改主题

- `POST /posts`
- `PUT /t/{topicId}.json`
- `PUT /t/{topicId}/status`
- `POST /t/{topicId}/invite`
- `PUT /t/{topicId}/notifications`
- `GET /discourse-ai/summarization/t/{topicId}`

请求/响应格式:
- 路径已确认
- 具体 body 字段未在当前整理中完整展开

## 6. 帖子 / Post

来源:
- `thirdparty/fluxdo/lib/services/discourse/_posts.dart`

已确认接口:
- `POST /post_actions`
- `POST /posts/{postId}/bookmark`
- `DELETE /bookmarks/{bookmarkId}.json`
- `PUT /posts/{postId}.json`
- `GET /posts/{postId}.json`
- `DELETE /posts/{postId}.json`
- `PUT /posts/{postId}/recover.json`
- `GET /posts/{postId}/reply-history`
- `GET /posts/{postId}/reply-ids.json`
- `GET /posts/{postId}/cooked.json`
- `GET /posts/by_number/{topicId}/{postNumber}`
- `GET /post_action_types.json`
- `GET /discourse-reactions/posts/{postId}/reactions-users.json`
- `PUT /discourse-reactions/posts/{postId}/custom-reactions/{reaction}/toggle.json`

请求/响应格式:
- 已确认路径与部分用途
- 完整 body/response 需单独按 Post 模型补充

## 7. 用户 / User

来源:
- `thirdparty/fluxdo/lib/services/discourse/_users.dart`

已确认接口:
- `GET /u/{username}.json`
- `GET /u/{username}/summary.json`
- `GET /u/{username}/follow/following`
- `GET /u/{username}/follow/followers`
- `PUT /follow/{username}`
- `DELETE /follow/{username}`
- `GET /badges/{badgeId}.json`
- `GET /u/{username}/invited/pending`
- `POST /invites`

已确认的简化用户字段:
```json
{
  "id": 123,
  "username": "string",
  "name": "string",
  "avatar_template": "/user_avatar/linux.do/name/{size}/1.png"
}
```

来源:
- `thirdparty/fluxdo/lib/models/user.dart`

## 8. 搜索 / Search

来源:
- `thirdparty/fluxdo/lib/services/discourse/_search.dart`
- `src/api/linuxdo.ts`

已确认接口:
- `GET /search.json`
- `GET /discourse-ai/embeddings/semantic-search`
- `GET /u/recent-searches.json`
- `DELETE /u/recent-searches.json`
- `GET /tags/filter/search`
- `GET /u/search/users`

请求/响应格式:
- FluxDO 内部可使用 `/search.json` 或 `/search/query.json`（取决于调用方实现）
- 当前 Tauri 项目搜索已切换为：
  - Method: `GET`
  - Path: `/search.json`
  - Query:
    - `q=<查询>`
    - `page=<页码>`（仅 `page > 1` 时传）
    - `type_filter=topic`
- 当前 Tauri 项目分页判断依赖响应：
  - `grouped_search_result.more_full_page_results`
  - `grouped_search_result.more_posts`

## 9. 草稿 / Draft

来源:
- `thirdparty/fluxdo/lib/services/discourse/_drafts.dart`

已确认接口:
- `GET /drafts.json`
- `GET /drafts/{draftKey}.json`
- `POST /draft.json`
- `DELETE /draft.json`

请求/响应格式:
- 路径已确认
- 完整字段未在本次补充中展开

## 10. 模板 / Template

来源:
- `thirdparty/fluxdo/lib/services/discourse/_templates.dart`

已确认接口:
- `GET /discourse_templates`
- `POST /discourse_templates/{templateId}/use`

## 11. 上传 / Upload

来源:
- `thirdparty/fluxdo/lib/services/discourse/_uploads.dart`

已确认接口:
- `GET /uploads/lookup-metadata`
- `POST /uploads.json`
- `POST /create-multipart.json`

请求格式:
- `POST /uploads.json` 使用 multipart/form-data

## 12. 反应 / 投票 / 工具接口

来源:
- `thirdparty/fluxdo/lib/services/discourse/_utils.dart`
- `thirdparty/fluxdo/lib/services/discourse/_voting.dart`
- `thirdparty/fluxdo/lib/services/discourse/_posts.dart`

已确认接口:
- `GET /emojis.json`
- `POST /composer_messages/find`
- `GET /discourse-reactions/posts/reactions.json`
- `PUT /discourse-reactions/posts/{postId}/custom-reactions/{reaction}/toggle.json`
- `GET /discourse-reactions/posts/{postId}/reactions-users.json`
- `PUT /polls/vote`
- `DELETE /polls/vote`
- `POST /polls/toggle-status`
- `POST /polls/voters`
- `GET /polls/grouped_poll_results`

## 13. credit.linux.do

来源:
- `thirdparty/fluxdo/lib/services/ldc_oauth_service.dart`
- `thirdparty/fluxdo/lib/modules/ldc_reward/services/ldc_reward_service.dart`

### 13.1 OAuth

- `GET https://credit.linux.do/api/v1/oauth/login`
- `POST https://credit.linux.do/api/v1/oauth/callback`
- `GET https://credit.linux.do/api/v1/oauth/logout`
- `GET https://credit.linux.do/api/v1/oauth/user-info`

请求格式:

登录入口:
```http
GET /api/v1/oauth/login HTTP/1.1
Host: credit.linux.do
```

回调:
```json
{
  "code": "string",
  "state": "string"
}
```

用户信息响应格式:
```json
{
  "data": {
    "id": 1,
    "username": "string",
    "nickname": "string",
    "trustLevel": 1,
    "avatarUrl": "https://...",
    "totalReceive": 0,
    "totalPayment": 0,
    "totalTransfer": 0,
    "totalCommunity": 0,
    "communityBalance": 0,
    "availableBalance": 0,
    "payScore": 0,
    "isPayKey": false,
    "isAdmin": false,
    "remainQuota": 0,
    "payLevel": 0,
    "dailyLimit": 0
  }
}
```

说明:
- 上述字段来自 `LdcUserInfo.fromJson` 与 `ldc_oauth_service.dart` 中的组装逻辑。

### 13.2 分发/打赏

- `POST https://credit.linux.do/epay/pay/distribute`
- 来源:
  - `thirdparty/fluxdo/lib/modules/ldc_reward/services/ldc_reward_service.dart`

## 14. connect.linux.do

来源:
- `thirdparty/fluxdo/lib/providers/directory_providers.dart`
- `thirdparty/fluxdo/lib/services/ldc_oauth_service.dart`
- `thirdparty/fluxdo/lib/services/cdk_oauth_service.dart`

已确认接口:
- `GET https://connect.linux.do/`
- `GET https://connect.linux.do{approveLink}`

请求/响应格式:
- 这里主要用于 HTML 页面抓取和 OAuth 授权确认
- 源码里通过解析 HTML 中的 `a[href*="/oauth2/approve/"]` 提取下一步链接
- 不属于 JSON API

## 15. 请求头与鉴权行为

FluxDO 代码中已确认的请求行为:

- 非 GET 请求前，若缺少 token，会先调用 `GET /session/csrf`
- 非 GET 请求会带 `X-CSRF-Token`
- 主站请求头会附带:
  - `Origin: https://linux.do`
  - `Referer: https://linux.do/`
- 已登录状态下会附带:
  - `Discourse-Logged-In: true`
  - `Discourse-Present: true`
- 会检测响应头:
  - `discourse-logged-out`
  - `x-discourse-username`

来源:
- `thirdparty/fluxdo/lib/services/network/interceptors/request_header_interceptor.dart`
- `thirdparty/fluxdo/lib/services/discourse/_auth.dart`

## 16. 建议优先实现的最小可用接口

如果要做 Tauri 可用版本，优先级建议如下:

1. `GET /session/current.json`
2. `GET /session/csrf`
3. `GET /notifications`
4. `PUT /notifications/mark-read`
5. `GET /message-bus/{clientId}/poll`

这 5 组已经足够支撑:
- 登录态检测
- 初始消息列表
- 已读状态更新
- 实时通知增量刷新
