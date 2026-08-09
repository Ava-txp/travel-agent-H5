<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { login, register } from "@/api/auth";

const router = useRouter();
const route = useRoute();

const mode = ref<"login" | "register">("login");
const account = ref("");
const password = ref("");
const nickname = ref("");
const submitting = ref(false);

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/profile");
};

const onSubmit = async () => {
  if (submitting.value) return;

  const acc = account.value.trim();
  const pwd = password.value;
  if (!acc) {
    showToast("请输入手机号或邮箱");
    return;
  }
  if (pwd.length < 6) {
    showToast("密码至少 6 位");
    return;
  }

  submitting.value = true;
  try {
    const result =
      mode.value === "login"
        ? await login({ account: acc, password: pwd })
        : await register({
            account: acc,
            password: pwd,
            nickname: nickname.value.trim() || undefined,
          });

    if (result.mergedConversations > 0) {
      showToast(`登录成功，已同步 ${result.mergedConversations} 个会话`);
    } else {
      showToast(mode.value === "login" ? "登录成功" : "注册成功");
    }

    const redirect =
      typeof route.query.redirect === "string" && route.query.redirect
        ? route.query.redirect
        : "/profile";
    await router.replace(redirect);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "操作失败");
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div class="login">
    <van-nav-bar
      :title="mode === 'login' ? '登录' : '注册'"
      left-arrow
      fixed
      placeholder
      @click-left="goBack"
    />

    <div class="login__body">
      <van-tabs v-model:active="mode" shrink>
        <van-tab title="登录" name="login" />
        <van-tab title="注册" name="register" />
      </van-tabs>

      <van-cell-group inset class="login__form">
        <van-field
          v-model="account"
          label="账号"
          placeholder="手机号或邮箱"
          clearable
          autocomplete="username"
        />
        <van-field
          v-model="password"
          type="password"
          label="密码"
          placeholder="至少 6 位"
          clearable
          autocomplete="current-password"
        />
        <van-field
          v-if="mode === 'register'"
          v-model="nickname"
          label="昵称"
          placeholder="可选"
          maxlength="20"
          clearable
        />
      </van-cell-group>

      <div class="login__actions">
        <van-button
          type="primary"
          block
          round
          :loading="submitting"
          @click="onSubmit"
        >
          {{ mode === "login" ? "登录" : "注册并登录" }}
        </van-button>
        <p class="login__tip">
          登录后可将本机匿名会话同步到账号，换设备也能查看历史对话。
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login {
  min-height: 100%;
  background: #f7f8fa;
  text-align: left;
}

.login__body {
  padding: 12px 0 24px;
}

.login__form {
  margin-top: 12px;
}

.login__actions {
  padding: 24px 16px 0;
}

.login__tip {
  margin: 12px 4px 0;
  font-size: 12px;
  line-height: 1.5;
  color: #969799;
}
</style>
