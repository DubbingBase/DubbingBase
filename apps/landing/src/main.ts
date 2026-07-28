import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

import { createHead } from "@unhead/vue/client";
import { i18n } from "./i18n/setup";

const app = createApp(App);
const head = createHead();

app.use(router);
app.use(head);
app.use(i18n);

app.mount("#app");
