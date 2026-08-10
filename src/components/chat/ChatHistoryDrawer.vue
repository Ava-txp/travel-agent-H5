<script setup lang="ts">
import type { ConversationSummary } from "@/api/travel";
import ChatContextMenu from "./ChatContextMenu.vue";

defineProps<{
  show: boolean;
  loading: boolean;
  conversations: ConversationSummary[];
  conversationId: string | null;
  sending: boolean;
  renamingId: string | null;
  renameTitle: string;
  historyMenuVisible: boolean;
  actionTarget: ConversationSummary | null;
  historyMenuAbove: boolean;
  historyMenuStyle: Record<string, string>;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  "update:renameTitle": [value: string];
  newChat: [];
  select: [id: string];
  setItemRef: [id: string, el: unknown];
  setRenameInputRef: [el: unknown];
  pressStart: [item: ConversationSummary];
  pressEnd: [];
  pressMove: [];
  renameKeydown: [event: KeyboardEvent];
  renameBlur: [];
  closeMenu: [];
  contextPin: [];
  contextRename: [];
  contextDelete: [];
}>();
</script>

<template>
  <van-popup
    :show="show"
    position="right"
    class="chat__history-popup"
    :style="{ width: '82%', height: '100%' }"
    @update:show="emit('update:show', $event)"
  >
    <div class="chat__history">
      <div class="chat__history-header">
        <h2 class="chat__history-title">历史会话</h2>
        <button
          type="button"
          class="chat__history-new"
          :disabled="sending"
          @click="emit('newChat')"
        >
          新对话
        </button>
      </div>

      <div v-if="loading" class="chat__history-loading">
        <van-loading size="20" />
      </div>

      <van-empty
        v-else-if="conversations.length === 0"
        description="暂无历史会话"
      />

      <div v-else class="chat__history-list">
        <div
          v-for="item in conversations"
          :key="item.id"
          :ref="(el) => emit('setItemRef', item.id, el)"
          class="chat__history-item"
          :class="{
            'chat__history-item--active': item.id === conversationId,
            'chat__history-item--pinned': item.pinned,
            'chat__history-item--ghost':
              historyMenuVisible && actionTarget?.id === item.id,
          }"
          @touchstart.passive="emit('pressStart', item)"
          @touchend.passive="emit('pressEnd')"
          @touchcancel.passive="emit('pressEnd')"
          @touchmove.passive="emit('pressMove')"
          @mousedown="emit('pressStart', item)"
          @mouseup="emit('pressEnd')"
          @mouseleave="emit('pressEnd')"
          @contextmenu.prevent
        >
          <div
            v-if="renamingId === item.id"
            class="chat__history-main chat__history-main--editing"
            @touchstart.stop
            @mousedown.stop
          >
            <span v-if="item.pinned" class="chat__history-pin">置顶</span>
            <input
              :ref="(el) => emit('setRenameInputRef', el)"
              class="chat__history-rename-input"
              type="text"
              maxlength="40"
              placeholder="请输入会话名称"
              :value="renameTitle"
              @input="
                emit(
                  'update:renameTitle',
                  ($event.target as HTMLInputElement).value,
                )
              "
              @keydown="emit('renameKeydown', $event)"
              @blur="emit('renameBlur')"
            />
          </div>
          <button
            v-else
            type="button"
            class="chat__history-main"
            @click="emit('select', item.id)"
          >
            <div class="chat__history-item-title">
              <span v-if="item.pinned" class="chat__history-pin">置顶</span>
              <span class="chat__history-item-title-text">{{ item.title }}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </van-popup>

  <ChatContextMenu
    :visible="historyMenuVisible"
    :target="actionTarget"
    :above="historyMenuAbove"
    :menu-style="historyMenuStyle"
    @close="emit('closeMenu')"
    @pin="emit('contextPin')"
    @rename="emit('contextRename')"
    @delete="emit('contextDelete')"
  />
</template>

<style scoped>
.chat__history {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.chat__history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #ebedf0;
}

.chat__history-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #323233;
}

.chat__history-new {
  border: none;
  background: transparent;
  color: #1989fa;
  font-size: 14px;
  padding: 0;
  cursor: pointer;
}

.chat__history-new:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat__history-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.chat__history-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
}

.chat__history-item {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid #f5f6f7;
  border-left: 3px solid transparent;
  user-select: none;
  -webkit-user-select: none;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.chat__history-item--active {
  background: #e8f3ff;
  border-left-color: #1989fa;
}

.chat__history-item--active .chat__history-item-title-text {
  color: #1989fa;
  font-weight: 600;
}

.chat__history-item--ghost {
  opacity: 0;
}

.chat__history-main {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  text-align: left;
  padding: 14px 16px 14px 13px;
  cursor: pointer;
}

.chat__history-main--editing {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: text;
}

.chat__history-item-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 15px;
  color: #323233;
  line-height: 1.4;
}

.chat__history-item-title-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat__history-rename-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid #1989fa;
  border-radius: 6px;
  outline: none;
  background: #fff;
  font-size: 15px;
  line-height: 28px;
  color: #323233;
  box-sizing: border-box;
}

.chat__history-pin {
  flex-shrink: 0;
  padding: 0 4px;
  border-radius: 3px;
  background: #fff7e8;
  color: #ff976a;
  font-size: 11px;
  line-height: 18px;
}
</style>
