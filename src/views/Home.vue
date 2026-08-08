<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
// 引入 城市选择 数据，若需要更新城市信息，需要升级npm包
import { areaList } from "@vant/area-data";
import type { PickerConfirmEventParams } from "vant";
import { debounceLeading } from "@/utils/debounce";
// showToast 由 unplugin-auto-import + VantResolver 自动引入（含样式）

const router = useRouter();

// 生成旅游推荐需要的表单数据
const form = ref({
  destination: "",
  budget: "",
  days: "",
});

// 是否展示 城市选择弹窗
const showAreaPicker = ref(false);

// 底部写死的 “热门目的地城市”
const popularCities = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "成都",
  "杭州",
  "西安",
  "重庆",
];

const openAreaPicker = () => {
  showAreaPicker.value = true;
};

// 确认城市选择后，更新表单数据
const onAreaConfirm = ({ selectedOptions }: PickerConfirmEventParams) => {
  const names = selectedOptions
    .filter((option) => option?.text)
    .map((option) => String(option!.text));

  // 取最后一级（市），旅游场景通常选到市级即可
  form.value.destination = names[names.length - 1] ?? "";
  showAreaPicker.value = false;
};

const selectCity = (city: string) => {
  form.value.destination = city;
};

// 立即触发防抖：首次成功跳转马上执行，1.5s 内重复跳转忽略
const navigateToDetail = debounceLeading(
  (city: string, budget: number, days: number) => {
    router.push({
      path: "/detail",
      query: {
        city,
        budget: String(budget),
        days: String(days),
      },
    });
  },
  1500,
);

const onStartPlan = () => {
  const city = form.value.destination.trim();
  const budget = Number(form.value.budget);
  const days = Number(form.value.days);

  if (!city) {
    showToast("请选择目的地");
    return;
  }
  if (!budget || budget < 100) {
    showToast("请输入有效预算（至少 100 元）");
    return;
  }
  if (!days || days < 1 || days > 30) {
    showToast("请输入有效旅行天数（1-30天）");
    return;
  }

  navigateToDetail(city, budget, days);
};
</script>

<template>
  <div class="home">
    <!-- 顶部导航栏 -->
    <van-nav-bar title="智能旅游助手" fixed placeholder />

    <!-- 公告栏 -->
    <van-notice-bar
      left-icon="info-o"
      color="#ed6a0c"
      background="#fffbe8"
      text="基于 AI 的智能景点介绍与行程规划系统"
    />

    <!-- 内容区域 -->
    <div class="home__content">
      <section class="home__card">
        <h2 class="home__card-title">规划你的旅程</h2>

        <!-- 
          is-link: 右侧显示箭头 >
          readonly: 只读，无法输入(无法唤起键盘)
          clearable: 显示清除按钮 (与readonly无法同时生效)
        -->
        <van-field
          v-model="form.destination"
          class="home__field"
          label="目的地"
          placeholder="请选择或输入城市"
          is-link
          readonly
          @click="openAreaPicker"
        />
        <van-field
          v-model="form.budget"
          class="home__field"
          type="digit"
          label="预算(元)"
          placeholder="请输入预算金额"
          clearable
        />
        <van-field
          v-model="form.days"
          class="home__field"
          type="digit"
          label="天数"
          placeholder="请输入旅行天数"
          clearable
        />

        <van-button
          type="primary"
          block
          round
          class="home__submit"
          @click="onStartPlan"
        >
          开始规划
        </van-button>
      </section>

      <!-- 快捷入口 -->
      <section class="home__card">
        <h2 class="home__card-title">快捷入口</h2>
        <van-grid :column-num="2" :border="false" :gutter="12">
          <van-grid-item @click="router.push('/chat')">
            <div class="home__shortcut">
              <van-icon name="chat-o" size="28" />
              <span>AI 对话</span>
            </div>
          </van-grid-item>
          <van-grid-item @click="router.push('/profile')">
            <div class="home__shortcut">
              <van-icon name="user-o" size="28" />
              <span>我的</span>
            </div>
          </van-grid-item>
        </van-grid>
      </section>

      <!-- 热门目的地 -->
      <section class="home__card">
        <h2 class="home__card-title">热门目的地</h2>
        <van-grid :column-num="4" :border="false" :gutter="10">
          <van-grid-item
            v-for="city in popularCities"
            :key="city"
            @click="selectCity(city)"
          >
            <div
              class="home__city"
              :class="{ 'home__city--active': form.destination === city }"
            >
              {{ city }}
            </div>
          </van-grid-item>
        </van-grid>
      </section>
    </div>

    <van-popup v-model:show="showAreaPicker" position="bottom" round>
      <van-area
        title="选择目的地"
        :area-list="areaList"
        :columns-num="2"
        @confirm="onAreaConfirm"
        @cancel="showAreaPicker = false"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.home {
  min-height: 100%;
  background: #f7f8fa;
  text-align: left;
  padding-bottom: 60px;
}

.home__content {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.home__card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
}

.home__card-title {
  margin: 0 0 14px;
  font-size: 16px;
  font-weight: 600;
  color: #323233;
  line-height: 1.4;
}

.home__field {
  margin-bottom: 10px;
  background: #f7f8fa;
  border-radius: 8px;
  overflow: hidden;
}

.home__field :deep(.van-field__label) {
  color: #323233;
  width: 4.8em;
}

.home__submit {
  margin-top: 6px;
}

.home__shortcut {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 88px;
  border-radius: 10px;
  color: #323233;
  font-size: 14px;
}

.home__city {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  width: 100%;
  background: #f7f8fa;
  border-radius: 8px;
  color: #323233;
  font-size: 13px;
}

.home__city--active {
  background: #e8f3ff;
  color: #1989fa;
}

.home :deep(.van-grid-item__content) {
  padding: 0;
  background: transparent;
}

.home :deep(.van-notice-bar) {
  font-size: 13px;
}
</style>
