<script setup lang="ts">
import { useRouter } from "vue-router";
// showToast 由 unplugin-auto-import + VantResolver 自动引入（含样式）

const router = useRouter();

const avatarUrl = "https://fastly.jsdelivr.net/npm/@vant/assets/cat.jpeg";
const appVersion = "v1.0.0";

// 返回按钮
const goBack = () => router.back();

// 站位
const onMenuClick = (label: string) => showToast(`${label}功能开发中`);
</script>

<template>
  <div class="profile">
    <van-nav-bar
      title="我的"
      left-arrow
      fixed
      placeholder
      @click-left="goBack"
    />

    <!-- 用户信息展示 -->
    <section class="profile__header">
      <van-image
        class="profile__avatar"
        round
        width="64"
        height="64"
        fit="cover"
        :src="avatarUrl"
      />
      <div class="profile__user">
        <h1 class="profile__name">游客A</h1>
        <p class="profile__desc">欢迎使用智能旅游助手</p>
      </div>
    </section>

    <div class="profile__body">
      <section class="profile__section">
        <h2 class="profile__section-title">我的服务</h2>
        <van-cell-group :border="false">
          <van-cell
            title="我的收藏"
            is-link
            icon="star-o"
            @click="onMenuClick('我的收藏')"
          />
          <van-cell title="历史记录" is-link @click="onMenuClick('历史记录')" />
          <van-cell title="设置" is-link @click="onMenuClick('设置')" />
        </van-cell-group>
      </section>

      <section class="profile__section">
        <h2 class="profile__section-title">关于</h2>
        <van-cell-group :border="false">
          <van-cell title="关于我们" is-link @click="onMenuClick('关于我们')" />
          <van-cell title="版本信息" :value="appVersion" />
        </van-cell-group>
      </section>
    </div>
  </div>
</template>

<style scoped>
.profile {
  min-height: 100%;
  background: #f7f8fa;
  padding-bottom: 60px;
  text-align: left;
}

.profile__header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 20px;
  background: linear-gradient(90deg, #3b82f6 0%, #22d3ee 100%);
}

.profile__avatar {
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.profile__user {
  min-width: 0;
}

.profile__name {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: #fff;
}

.profile__desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.92);
}

.profile__body {
  background: #f7f8fa;
}

.profile__section {
  margin-top: 10px;
  background: #fff;
}

.profile__section:first-child {
  margin-top: 0;
}

.profile__section-title {
  margin: 0;
  padding: 16px 16px 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.4;
  color: #969799;
}

.profile :deep(.van-cell) {
  font-size: 15px;
  color: #323233;
}

.profile :deep(.van-cell__value) {
  color: #c8c9cc;
}

.profile :deep(.van-cell__left-icon) {
  color: #323233;
  font-size: 18px;
  margin-right: 8px;
}

.profile :deep(.van-hairline--top-bottom::after),
.profile :deep(.van-hairline-unset--top-bottom::after) {
  border-width: 0;
}
</style>
