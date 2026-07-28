import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./assets/main.css";

import { createHead } from "@unhead/vue/client";

const app = createApp(App);
const head = createHead();

app.use(router);
app.use(head);

app.mount("#app");
