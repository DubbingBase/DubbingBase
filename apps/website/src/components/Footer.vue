<template>
  <footer
    class="mt-20 border-t theme-border-subtle theme-border bg-white theme-bg pt-16 pb-8 theme-text-muted"
  >
    <div class="max-w-7xl mx-auto px-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <!-- Brand -->
        <div class="col-span-1 md:col-span-1">
          <NuxtLink
            :to="localePath('/')"
            class="text-2xl font-extrabold theme-text inline-block mb-4"
          >
            {{ t("app.title") }}
          </NuxtLink>
          <p class="text-sm theme-text-muted mb-6 leading-relaxed">
            {{ t("app.description") }}
          </p>
          <div class="flex items-center gap-4">
            <a
              href="https://x.com/DubbingBase"
              aria-label="Twitter"
              target="_blank"
              rel="noopener noreferrer"
              class="theme-text-muted theme-hover-text transition"
            >
              <TwitterIcon :size="20" />
            </a>
            <a
              href="https://instagram.com/dubbingbase"
              aria-label="Instagram"
              target="_blank"
              rel="noopener noreferrer"
              class="theme-text-muted theme-hover-text transition"
            >
              <InstagramIcon :size="20" />
            </a>
            <a
              href="https://discord.gg/Jm2EmnnpG"
              aria-label="Discord"
              target="_blank"
              rel="noopener noreferrer"
              class="theme-text-muted hover:text-[#5865F2] dark:hover:text-[#5865F2] transition"
            >
              <MessageSquareIcon :size="20" />
            </a>
            <a
              href="mailto:contact@dubbingbase.com"
              aria-label="Email"
              class="theme-text-muted theme-hover-text transition"
            >
              <MailIcon :size="20" />
            </a>
          </div>
        </div>

        <!-- Explore -->
        <div>
          <h3 class="theme-text font-semibold mb-4">
            {{ t("footer.explore") }}
          </h3>
          <ul class="space-y-3 text-sm">
            <li>
              <NuxtLink
                :to="localePath('/movies')"
                class="theme-hover-text transition"
                >{{ t("footer.movies") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/series')"
                class="theme-hover-text transition"
                >{{ t("footer.series") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/voice-actors')"
                class="theme-hover-text transition"
                >{{ t("footer.voiceActors") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/studios')"
                class="theme-hover-text transition"
                >{{ t("footer.studios") }}</NuxtLink
              >
            </li>
          </ul>
        </div>

        <!-- Community -->
        <div>
          <h3 class="theme-text font-semibold mb-4">
            {{ t("footer.community") }}
          </h3>
          <ul class="space-y-3 text-sm">
            <li>
              <NuxtLink
                :to="localePath('/guidelines')"
                class="theme-hover-text transition"
                >{{ t("footer.guidelines") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/discussions')"
                class="theme-hover-text transition"
                >{{ t("footer.discussions") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/leaderboard')"
                class="theme-hover-text transition"
                >{{ t("footer.leaderboard") }}</NuxtLink
              >
            </li>
          </ul>
        </div>

        <!-- Legal -->
        <div>
          <h3 class="theme-text font-semibold mb-4">
            {{ t("footer.legal") }}
          </h3>
          <ul class="space-y-3 text-sm">
            <li>
              <NuxtLink
                :to="localePath('/about')"
                class="theme-hover-text transition"
                >{{ t("about.title") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/legal')"
                class="theme-hover-text transition"
                >{{ t("footer.legalNotice") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/privacy')"
                class="theme-hover-text transition"
                >{{ t("footer.privacy") }}</NuxtLink
              >
            </li>
            <li>
              <NuxtLink
                :to="localePath('/terms')"
                class="theme-hover-text transition"
                >{{ t("footer.terms") }}</NuxtLink
              >
            </li>
            <li>
              <a
                href="mailto:contact@dubbingbase.com"
                class="theme-hover-text transition"
                >{{ t("footer.contact") }}</a
              >
            </li>
          </ul>
        </div>
      </div>

      <div
        class="pt-8 border-t theme-border-subtle theme-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs theme-text-muted"
      >
        <p>
          &copy; {{ new Date().getFullYear() }} DubbingBase.
          {{ t("footer.rights") }}
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import {
  TwitterIcon,
  InstagramIcon,
  MailIcon,
  MessageSquareIcon,
} from "lucide-vue-next";

const { t } = useI18n();
const localePath = useLocalePath();
</script>
