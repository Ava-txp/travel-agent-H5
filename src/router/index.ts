import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "home",
      component: () => import("@/views/Home.vue"),
    },
    {
      path: "/chat",
      name: "chat",
      component: () => import("@/views/Chat.vue"),
    },
    {
      path: "/profile",
      name: "profile",
      component: () => import("@/views/Profile.vue"),
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/Login.vue"),
      meta: {
        hideTabbar: true,
      },
    },
    {
      path: "/detail",
      name: "detail",
      component: () => import("@/views/Detail.vue"),
      meta: {
        hideTabbar: true,
      },
    },
    {
      path: "/plans",
      name: "plans",
      component: () => import("@/views/PlanRecords.vue"),
      meta: {
        hideTabbar: true,
      },
    },
  ],
});


export default router;
