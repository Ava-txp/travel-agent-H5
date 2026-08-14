<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { usePlanLoad } from "@/composables/plan/usePlanLoad";
import PlanLoading from "@/components/plan/PlanLoading.vue";
import PlanErrorState from "@/components/plan/PlanErrorState.vue";
import PlanResult from "@/components/plan/PlanResult.vue";

const router = useRouter();
const {
  city,
  budget,
  days,
  isHistoryView,
  pageTitle,
  planData,
  hint,
  isPending,
  isFailed,
  isStreaming,
  loadPlan,
  cancelLoad,
} = usePlanLoad();

const goBack = () => {
  cancelLoad();
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.push("/");
};

onMounted(() => {
  loadPlan();
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
      <PlanLoading
        v-if="isPending && !planData"
        :hint="hint"
        :show-cancel="!isHistoryView"
        @cancel="cancelLoad"
      />

      <PlanResult
        v-else-if="planData"
        :plan="planData"
        :city="city"
        :budget="budget"
        :days="days"
        :streaming="isStreaming"
        :failed="isFailed"
        :hint="hint"
        @retry="loadPlan"
      />

      <PlanErrorState
        v-else-if="isFailed"
        :hint="hint"
        @retry="loadPlan"
      />
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
</style>
