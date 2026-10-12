import { createRouter, createWebHistory } from "vue-router";
import { api, initializeAdminSession } from "./api.js";
import PublicHome from "./views/PublicHome.vue";
import AdminLogin from "./views/AdminLogin.vue";
import AdminLayout from "./views/AdminLayout.vue";
import AdminDashboard from "./views/AdminDashboard.vue";
import AdminSettings from "./views/AdminSettings.vue";
import AdminResources from "./views/AdminResources.vue";
import AdminAppearance from "./views/AdminAppearance.vue";
import AdminProfile from "./views/AdminProfile.vue";
import NotFound from "./views/NotFound.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: PublicHome },
    { path: "/admin", component: AdminLogin },
    {
      path: "/admin",
      component: AdminLayout,
      meta: { requiresAdmin: true },
      children: [
        { path: "dashboard", component: AdminDashboard },
        { path: "settings", component: AdminSettings },
        { path: "features", redirect: "/admin/commands" },
        { path: "commands", component: AdminResources, props: { table: "commands" } },
        { path: "faqs", component: AdminResources, props: { table: "faqs" } },
        { path: "contacts", component: AdminResources, props: { table: "contacts" } },
        { path: "appearance", component: AdminAppearance },
        { path: "profile", component: AdminProfile },
        { path: "", redirect: "/admin/dashboard" },
      ],
    },
    { path: "/:pathMatch(.*)*", component: NotFound },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    return to.hash ? { el: to.hash, behavior: "smooth" } : { top: 0 };
  },
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin) {
    if (to.path === "/admin") {
      try {
        const session = await initializeAdminSession();
        if (session.authenticated) return "/admin/dashboard";
      } catch {
        return true;
      }
    }
    return true;
  }
  try {
    const session = await initializeAdminSession();
    if (!session.authenticated) return "/admin";
  } catch {
    return "/admin";
  }
  return true;
});

export default router;
