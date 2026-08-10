<script setup lang="ts">
import type { ConversationSummary } from "@/api/travel";

defineProps<{
  visible: boolean;
  target: ConversationSummary | null;
  above: boolean;
  menuStyle: Record<string, string>;
}>();

const emit = defineEmits<{
  close: [];
  pin: [];
  rename: [];
  delete: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && target"
      class="chat-ctx"
      @click="emit('close')"
    >
      <div class="chat-ctx__backdrop" />
      <div
        class="chat-ctx__float"
        :class="{ 'chat-ctx__float--above': above }"
        :style="menuStyle"
        @click.stop
      >
        <div class="chat-ctx__card">
          <div class="chat-ctx__card-icon" aria-hidden="true">
            <van-icon name="chat-o" size="18" />
          </div>
          <div class="chat-ctx__card-title">{{ target.title }}</div>
        </div>
        <div class="chat-ctx__menu">
          <button type="button" class="chat-ctx__action" @click="emit('pin')">
            <span>{{ target.pinned ? "取消置顶" : "置顶" }}</span>
            <van-icon
              :name="target.pinned ? 'down' : 'back-top'"
              size="18"
            />
          </button>
          <button
            type="button"
            class="chat-ctx__action"
            @click="emit('rename')"
          >
            <span>编辑对话名称</span>
            <van-icon name="edit" size="18" />
          </button>
          <button
            type="button"
            class="chat-ctx__action chat-ctx__action--danger"
            @click="emit('delete')"
          >
            <span>从对话列表删除</span>
            <van-icon name="delete-o" size="18" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style>
/* Teleport 到 body，需非 scoped */
.chat-ctx {
  position: fixed;
  inset: 0;
  z-index: 4000;
}

.chat-ctx__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(40, 40, 40, 0.28);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  animation: chat-ctx-fade-in 0.18s ease;
}

.chat-ctx__float {
  position: fixed;
  z-index: 1;
  animation: chat-ctx-pop-in 0.2s ease;
}

.chat-ctx__card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--ctx-card-height, 48px);
  padding: 12px 14px;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.14);
  box-sizing: border-box;
}

.chat-ctx__card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #f2f3f5;
  color: #646566;
}

.chat-ctx__card-title {
  min-width: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  color: #323233;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-ctx__menu {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.chat-ctx__float--above .chat-ctx__menu {
  top: auto;
  bottom: calc(100% + 8px);
}

.chat-ctx__action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  margin: 0;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid rgba(60, 60, 67, 0.12);
  background: transparent;
  color: #323233;
  font-size: 15px;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.chat-ctx__action:last-child {
  border-bottom: none;
}

.chat-ctx__action:active {
  background: rgba(0, 0, 0, 0.04);
}

.chat-ctx__action--danger {
  color: #ee0a24;
}

@keyframes chat-ctx-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes chat-ctx-pop-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
