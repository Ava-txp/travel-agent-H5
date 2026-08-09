<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  fetchPlanDetail,
  fetchTravelRecommend,
  type DailyItinerary,
  type TravelPeriod,
  type TravelPlan,
} from "@/api/travel";
// showToast 由 unplugin-auto-import + VantResolver 自动引入（含样式）

type PeriodKey = "morning" | "afternoon" | "evening";

const periodMeta: Record<PeriodKey, { label: string; icon: string }> = {
  morning: { label: "上午", icon: "clock-o" },
  afternoon: { label: "下午", icon: "underway-o" },
  evening: { label: "晚上", icon: "bulb-o" },
};

const budgetLabels: Record<string, string> = {
  accommodation: "住宿",
  food: "餐饮",
  transportation: "交通",
  tickets: "门票",
  other: "其他",
};

const route = useRoute(); // 当前路由
const router = useRouter(); // 总路由

const planId = computed(() => String(route.query.id || ""));
const city = computed(() => String(route.query.city || ""));
const budget = computed(() => Number(route.query.budget || 0));
const days = computed(() => Number(route.query.days || 0));
const isHistoryView = computed(() => Boolean(planId.value));

const loading = ref(true);
const errorMessage = ref("");
const planData = ref<TravelPlan | null>(null);
const activeDay = ref(0);
const expandedKeys = ref<string[]>([]);

let abortController: AbortController | null = null;

const abortPendingRequest = () => {
  abortController?.abort();
  abortController = null;
};

const pageTitle = computed(() => {
  const displayCity = planData.value?.city || city.value;
  return displayCity ? `${displayCity}行程规划` : "行程规划";
});

const summaryText = computed(() => {
  const plan = planData.value;
  const displayCity = plan?.city || city.value;
  const displayDays = plan?.days || days.value;
  const displayBudget = plan?.totalBudget || budget.value;
  return `${displayCity} · ${displayDays}天 · 预算¥${displayBudget}`;
});

const dayList = computed(() => planData.value?.dailyItinerary ?? []);

const currentDay = computed<DailyItinerary | null>(
  () => dayList.value[activeDay.value] ?? null,
);

const budgetItems = computed(() => {
  const breakdown = planData.value?.budgetBreakdown;
  if (!breakdown) return [];

  return Object.entries(breakdown).map(([key, value]) => ({
    key,
    label: budgetLabels[key] || key,
    value,
  }));
});

const periodEntries = computed(() => {
  const day = currentDay.value;
  if (!day) return [];

  return (["morning", "afternoon", "evening"] as PeriodKey[]).map((key) => ({
    key,
    ...periodMeta[key],
    data: day[key] as TravelPeriod,
  }));
});

const toggleExpand = (key: string) => {
  if (expandedKeys.value.includes(key)) {
    expandedKeys.value = expandedKeys.value.filter((item) => item !== key);
    return;
  }
  expandedKeys.value = [...expandedKeys.value, key];
};

const goBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};

const loadPlan = async () => {
  // 历史记录：按 id 读取已落库规划；新建：带 city/budget/days 重新生成
  if (!planId.value && (!city.value || !budget.value || !days.value)) {
    loading.value = false;
    errorMessage.value = "缺少必要参数，请返回重新填写";
    return;
  }

  // 这里提前调用一次abortPendingRequest，是防止前序点击操作未防抖造成的重复请求
  abortPendingRequest();
  abortController = new AbortController();
  const { signal } = abortController;

  loading.value = true;
  errorMessage.value = "";
  planData.value = null;
  activeDay.value = 0;
  expandedKeys.value = [];

  try {
    if (planId.value) {
      const detail = await fetchPlanDetail(planId.value, signal);
      const data = detail.plan;
      if (!data || data.success === false) {
        throw new Error(data?.message || "规划记录无效");
      }
      planData.value = {
        ...data,
        id: detail.id,
        city: data.city || detail.city,
        days: data.days ?? detail.days,
        totalBudget: data.totalBudget ?? detail.totalBudget,
      };
    } else {
      const result = await fetchTravelRecommend(
        {
          city: city.value,
          budget: budget.value,
          days: days.value,
        },
        signal,
      );

      const data = result.data;
      if (!data || data.success === false) {
        throw new Error(data?.message || "生成旅游规划失败");
      }

      planData.value = data;
    }
  } catch (error) {
    // 返回/卸载导致的取消，不提示错误（兼容 fetch AbortError / axios CanceledError）
    const err = error as { name?: string; code?: string };
    if (
      signal.aborted ||
      err?.name === "AbortError" ||
      err?.name === "CanceledError" ||
      err?.code === "ERR_CANCELED"
    ) {
      return;
    }

    errorMessage.value =
      error instanceof Error
        ? error.message
        : isHistoryView.value
          ? "加载规划记录失败"
          : "生成旅游规划失败";
    showToast(errorMessage.value);
  } finally {
    if (!signal.aborted) {
      loading.value = false;
    }
    if (abortController?.signal === signal) {
      abortController = null;
    }
  }
};

onMounted(() => {
  loadPlan();
});

onUnmounted(() => {
  abortPendingRequest();
});
</script>

<template>
  <div class="detail">
    <van-nav-bar
      :title="pageTitle"
      left-text="返回"
      left-arrow
      fixed
      placeholder
      @click-left="goBack"
    />

    <div class="detail__body">
      <!-- 调用大模型的loading状态 -->
      <div v-if="loading" class="detail__loading">
        <van-loading size="24px">
          {{ isHistoryView ? "正在加载规划记录..." : "正在生成旅游规划..." }}
        </van-loading>
      </div>

      <!-- 调用大模型的错误状态 -->
      <van-empty v-else-if="errorMessage" image="error">
        <!-- 
          template: 虚拟包裹组件，类似与React.Fragment，不会生成真实的DOM节点 
          #description: 插槽简写，v-slot:description => 把内容放到子组件名为 description 的插槽里
        -->
        <template #description>
          <p class="detail__error">
            {{ isHistoryView ? "加载规划记录失败" : "生成旅游规划失败" }}
          </p>
        </template>
        <van-button
          round
          type="primary"
          class="detail__retry"
          @click="loadPlan"
        >
          重试
        </van-button>
      </van-empty>

      <div v-else-if="planData" class="detail__result">
        <section class="detail__card detail__summary">
          <h2 class="detail__summary-title">{{ planData.city || city }}</h2>
          <p class="detail__summary-text">{{ summaryText }}</p>
        </section>

        <section v-if="budgetItems.length" class="detail__card">
          <h3 class="detail__section-title">预算分配</h3>
          <div class="detail__budget-list">
            <div
              v-for="item in budgetItems"
              :key="item.key"
              class="detail__budget-item"
            >
              <span>{{ item.label }}</span>
              <strong>¥{{ item.value }}</strong>
            </div>
          </div>
        </section>

        <section v-if="dayList.length" class="detail__card detail__itinerary">
          <h3 class="detail__section-title">每日行程</h3>

          <van-tabs v-model:active="activeDay" shrink animated>
            <van-tab
              v-for="(day, index) in dayList"
              :key="day.day"
              :title="day.date || `第${day.day}天`"
              :name="index"
            />
          </van-tabs>

          <div v-if="currentDay" class="detail__timeline">
            <article
              v-for="period in periodEntries"
              :key="`${currentDay.day}-${period.key}`"
              class="detail__period"
            >
              <div class="detail__period-head">
                <van-icon :name="period.icon" color="#1989fa" />
                <span class="detail__period-label">{{ period.label }}</span>
              </div>

              <h4 class="detail__spot">{{ period.data.spot }}</h4>

              <div class="detail__meta">
                <div class="detail__meta-item">
                  <van-icon name="clock-o" />
                  <span>{{ period.data.duration || "时长待定" }}</span>
                </div>
                <div class="detail__meta-item">
                  <van-icon name="gold-coin-o" />
                  <span>{{ period.data.ticket || "费用待定" }}</span>
                </div>
                <div class="detail__meta-item">
                  <van-icon name="logistics" />
                  <span>{{ period.data.transportation || "交通待定" }}</span>
                </div>
              </div>

              <p
                class="detail__desc"
                :class="{
                  'detail__desc--collapsed': !expandedKeys.includes(
                    `${currentDay.day}-${period.key}`,
                  ),
                }"
              >
                {{ period.data.description }}
              </p>

              <button
                v-if="period.data.description"
                type="button"
                class="detail__expand"
                @click="toggleExpand(`${currentDay.day}-${period.key}`)"
              >
                {{
                  expandedKeys.includes(`${currentDay.day}-${period.key}`)
                    ? "收起"
                    : "展开介绍"
                }}
              </button>
            </article>
          </div>
        </section>

        <section v-if="planData.tips?.length" class="detail__card">
          <h3 class="detail__section-title">实用提示</h3>
          <ul class="detail__list">
            <li v-for="(tip, index) in planData.tips" :key="`tip-${index}`">
              {{ tip }}
            </li>
          </ul>
        </section>

        <section
          v-if="planData.warnings?.length"
          class="detail__card detail__warnings"
        >
          <h3 class="detail__section-title">注意事项</h3>
          <ul class="detail__list detail__list--warn">
            <li
              v-for="(warning, index) in planData.warnings"
              :key="`warn-${index}`"
            >
              {{ warning }}
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail {
  min-height: 100svh;
  background: #f7f8fa;
  text-align: left;
}

.detail__body {
  min-height: calc(100svh - 46px);
  padding: 12px;
}

.detail__loading {
  display: flex;
  justify-content: center;
  padding-top: 80px;
}

.detail__error {
  margin: 8px 0 0;
  color: #969799;
  font-size: 14px;
  padding: 0 16px;
}

.detail__retry {
  width: 140px;
  margin-top: 16px;
}

.detail__result {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}

.detail__card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.detail__summary-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
}

.detail__summary-text {
  margin: 0;
  font-size: 14px;
  color: #969799;
}

.detail__section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.detail__budget-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.detail__budget-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 8px;
  font-size: 13px;
  color: #646566;
}

.detail__budget-item strong {
  color: #323233;
  font-weight: 600;
}

.detail__itinerary :deep(.van-tabs__wrap) {
  margin: 0 -4px 12px;
}

.detail__timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail__period {
  padding: 12px;
  background: #f7f8fa;
  border-radius: 10px;
}

.detail__period-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.detail__period-label {
  font-size: 13px;
  color: #1989fa;
  font-weight: 600;
}

.detail__spot {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.detail__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.detail__meta-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: #646566;
  line-height: 1.4;
}

.detail__meta-item .van-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.detail__desc {
  margin: 0;
  font-size: 13px;
  color: #646566;
  line-height: 1.6;
}

.detail__desc--collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.detail__expand {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: #1989fa;
  font-size: 13px;
  cursor: pointer;
}

.detail__list {
  margin: 0;
  padding-left: 18px;
  color: #646566;
  font-size: 13px;
  line-height: 1.7;
}

.detail__list--warn {
  color: #ed6a0c;
}

.detail__warnings {
  background: #fffbe8;
}
</style>
