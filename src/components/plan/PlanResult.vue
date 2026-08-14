<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  DailyItinerary,
  TravelPeriod,
  TravelPlan,
} from "@/api/travel";
import type { LoadHint } from "@/composables/plan/types";

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

const props = defineProps<{
  plan: TravelPlan;
  city: string;
  budget: number;
  days: number;
  streaming?: boolean;
  failed?: boolean;
  hint?: LoadHint;
}>();

defineEmits<{
  retry: [];
}>();

const activeDay = ref(0);
const expandedKeys = ref<string[]>([]);

const summaryText = computed(() => {
  const displayCity = props.plan.city || props.city;
  const displayDays = props.plan.days || props.days;
  const displayBudget = props.plan.totalBudget || props.budget;
  return `${displayCity} · ${displayDays}天 · 预算¥${displayBudget}`;
});

const dayList = computed(() => props.plan.dailyItinerary ?? []);

const currentDay = computed<DailyItinerary | null>(
  () => dayList.value[activeDay.value] ?? null,
);

const budgetItems = computed(() => {
  const breakdown = props.plan.budgetBreakdown;
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
</script>

<template>
  <div class="plan-result">
    <van-notice-bar
      v-if="streaming && hint"
      color="#1989fa"
      background="#ecf9ff"
      :text="hint.title"
    />
    <van-notice-bar
      v-else-if="failed && hint"
      color="#ed6a0c"
      background="#fffbe8"
      :text="hint.title"
    />

    <section class="plan-result__card plan-result__summary">
      <h2 class="plan-result__summary-title">{{ plan.city || city }}</h2>
      <p class="plan-result__summary-text">{{ summaryText }}</p>
    </section>

    <section v-if="budgetItems.length" class="plan-result__card">
      <h3 class="plan-result__section-title">预算分配</h3>
      <div class="plan-result__budget-list">
        <div
          v-for="item in budgetItems"
          :key="item.key"
          class="plan-result__budget-item"
        >
          <span>{{ item.label }}</span>
          <strong>¥{{ item.value }}</strong>
        </div>
      </div>
    </section>

    <section v-if="dayList.length" class="plan-result__card">
      <h3 class="plan-result__section-title">每日行程</h3>
      <van-tabs v-model:active="activeDay" shrink animated>
        <van-tab
          v-for="(day, index) in dayList"
          :key="day.day"
          :title="day.date || `第${day.day}天`"
          :name="index"
        />
      </van-tabs>

      <div v-if="currentDay" class="plan-result__timeline">
        <article
          v-for="period in periodEntries"
          :key="`${currentDay.day}-${period.key}`"
          class="plan-result__period"
        >
          <div class="plan-result__period-head">
            <van-icon :name="period.icon" color="#1989fa" />
            <span class="plan-result__period-label">{{ period.label }}</span>
          </div>
          <h4 class="plan-result__spot">{{ period.data.spot }}</h4>
          <div class="plan-result__meta">
            <div class="plan-result__meta-item">
              <van-icon name="clock-o" />
              <span>{{ period.data.duration || "时长待定" }}</span>
            </div>
            <div class="plan-result__meta-item">
              <van-icon name="gold-coin-o" />
              <span>{{ period.data.ticket || "费用待定" }}</span>
            </div>
            <div class="plan-result__meta-item">
              <van-icon name="logistics" />
              <span>{{ period.data.transportation || "交通待定" }}</span>
            </div>
          </div>
          <p
            class="plan-result__desc"
            :class="{
              'plan-result__desc--collapsed': !expandedKeys.includes(
                `${currentDay.day}-${period.key}`,
              ),
            }"
          >
            {{ period.data.description }}
          </p>
          <button
            v-if="period.data.description"
            type="button"
            class="plan-result__expand"
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

    <section v-else-if="streaming" class="plan-result__card">
      <h3 class="plan-result__section-title">每日行程</h3>
      <van-skeleton title :row="5" />
    </section>

    <section v-if="plan.tips?.length" class="plan-result__card">
      <h3 class="plan-result__section-title">实用提示</h3>
      <ul class="plan-result__list">
        <li v-for="(tip, index) in plan.tips" :key="`tip-${index}`">
          {{ tip }}
        </li>
      </ul>
    </section>

    <section
      v-if="plan.warnings?.length"
      class="plan-result__card plan-result__warnings"
    >
      <h3 class="plan-result__section-title">注意事项</h3>
      <ul class="plan-result__list plan-result__list--warn">
        <li
          v-for="(warning, index) in plan.warnings"
          :key="`warn-${index}`"
        >
          {{ warning }}
        </li>
      </ul>
    </section>

    <van-button
      v-if="failed"
      round
      type="primary"
      class="plan-result__retry"
      :disabled="hint?.retryDisabled"
      @click="$emit('retry')"
    >
      {{ hint?.retryLabel || "重试" }}
    </van-button>
  </div>
</template>

<style scoped>
.plan-result {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 24px;
}

.plan-result__card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.plan-result__summary-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: #323233;
}

.plan-result__summary-text {
  margin: 0;
  font-size: 14px;
  color: #969799;
}

.plan-result__section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
}

.plan-result__budget-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.plan-result__budget-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 8px;
  font-size: 13px;
  color: #646566;
}

.plan-result__budget-item strong {
  color: #323233;
  font-weight: 600;
}

.plan-result :deep(.van-tabs__wrap) {
  margin: 0 -4px 12px;
}

.plan-result__timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-result__period {
  padding: 12px;
  background: #f7f8fa;
  border-radius: 10px;
}

.plan-result__period-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.plan-result__period-label {
  font-size: 13px;
  color: #1989fa;
  font-weight: 600;
}

.plan-result__spot {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.plan-result__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.plan-result__meta-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: #646566;
  line-height: 1.4;
}

.plan-result__meta-item .van-icon {
  margin-top: 2px;
  flex-shrink: 0;
}

.plan-result__desc {
  margin: 0;
  font-size: 13px;
  color: #646566;
  line-height: 1.6;
}

.plan-result__desc--collapsed {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.plan-result__expand {
  margin-top: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: #1989fa;
  font-size: 13px;
  cursor: pointer;
}

.plan-result__list {
  margin: 0;
  padding-left: 18px;
  color: #646566;
  font-size: 13px;
  line-height: 1.7;
}

.plan-result__list--warn {
  color: #ed6a0c;
}

.plan-result__warnings {
  background: #fffbe8;
}

.plan-result__retry {
  width: 160px;
  align-self: center;
}
</style>
