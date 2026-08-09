<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  deletePlan,
  fetchPlans,
  type PlanSummary,
} from "@/api/travel";
// showToast / showConfirmDialog 由 unplugin-auto-import + VantResolver 自动引入

const router = useRouter();

const loading = ref(true);
const plans = ref<PlanSummary[]>([]);
let abortController: AbortController | null = null;

const abortPending = () => {
  abortController?.abort();
  abortController = null;
};

const formatTime = (ts: number) => {
  const date = new Date(ts);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
};

const loadPlans = async () => {
  abortPending();
  abortController = new AbortController();
  const { signal } = abortController;

  loading.value = true;
  try {
    plans.value = await fetchPlans(signal);
  } catch (error) {
    const err = error as { name?: string; code?: string };
    if (
      signal.aborted ||
      err?.name === "AbortError" ||
      err?.name === "CanceledError" ||
      err?.code === "ERR_CANCELED"
    ) {
      return;
    }
    showToast(error instanceof Error ? error.message : "加载规划记录失败");
  } finally {
    if (!signal.aborted) {
      loading.value = false;
    }
    if (abortController?.signal === signal) {
      abortController = null;
    }
  }
};

const openPlan = (id: string) => {
  void router.push({ path: "/detail", query: { id } });
};

const onDelete = async (plan: PlanSummary) => {
  try {
    await showConfirmDialog({
      title: "删除规划",
      message: `确定删除「${plan.title}」吗？`,
    });
  } catch {
    return;
  }

  try {
    await deletePlan(plan.id);
    plans.value = plans.value.filter((item) => item.id !== plan.id);
    showToast("已删除");
  } catch (error) {
    showToast(error instanceof Error ? error.message : "删除失败");
  }
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};

const goHome = () => {
  void router.push("/");
};

onMounted(() => {
  void loadPlans();
});

onUnmounted(() => {
  abortPending();
});
</script>

<template>
  <div class="plans">
    <van-nav-bar
      title="规划记录"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="goBack"
    />

    <div class="plans__body">
      <div v-if="loading" class="plans__loading">
        <van-loading size="24px">加载中...</van-loading>
      </div>

      <van-empty v-else-if="!plans.length" description="暂无规划记录">
        <van-button round type="primary" class="plans__cta" @click="goHome">
          去规划行程
        </van-button>
      </van-empty>

      <van-cell-group v-else inset>
        <van-swipe-cell v-for="plan in plans" :key="plan.id">
          <van-cell
            is-link
            :title="plan.title"
            :label="`${plan.city} · ${plan.days}天 · 预算¥${plan.totalBudget}`"
            :value="formatTime(plan.createdAt)"
            @click="openPlan(plan.id)"
          />
          <template #right>
            <van-button
              square
              type="danger"
              text="删除"
              class="plans__delete"
              @click="onDelete(plan)"
            />
          </template>
        </van-swipe-cell>
      </van-cell-group>
    </div>
  </div>
</template>

<style scoped>
.plans {
  min-height: 100%;
  background: #f7f8fa;
  text-align: left;
}

.plans__body {
  padding: 12px 0 24px;
}

.plans__loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.plans__cta {
  width: 160px;
}

.plans__delete {
  height: 100%;
}

.plans :deep(.van-cell__title) {
  font-size: 15px;
  font-weight: 500;
  color: #323233;
}

.plans :deep(.van-cell__label) {
  margin-top: 4px;
  font-size: 12px;
  color: #969799;
}

.plans :deep(.van-cell__value) {
  font-size: 12px;
  color: #c8c9cc;
  align-self: center;
}
</style>
