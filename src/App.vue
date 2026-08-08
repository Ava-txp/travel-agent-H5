<template>
  <router-view />

  <van-tabbar v-if="!hideTabbar" route v-model="active">
    <van-tabbar-item icon="home-o" to="/">首页</van-tabbar-item>
    <van-tabbar-item icon="chat-o" to="/chat">对话</van-tabbar-item>
    <van-tabbar-item icon="user-o" to="/profile">我的</van-tabbar-item>
  </van-tabbar>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const active = ref(0)

const hideTabbar = computed(() => Boolean(route.meta.hideTabbar))
</script>
