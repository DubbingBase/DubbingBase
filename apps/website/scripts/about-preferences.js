(() => {
  const languages = ["en", "fr", "es", "ja"];
  const themes = ["system", "dark", "light"];
  const cookies = document.cookie.split("; ");
  const cookie = (name) =>
    cookies.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
  const routeLocale = location.pathname.startsWith("/fr/")
    ? "fr"
    : location.pathname.startsWith("/es/")
      ? "es"
      : location.pathname.startsWith("/ja/")
        ? "ja"
        : "en";
  const lightThemePage = location.pathname.endsWith(".light.html");
  const query = new URLSearchParams(location.search);
  const selectedLocale = query.get("lang");
  const selectedTheme = query.get("theme");
  const themeCookie = cookie("dubbingbase-theme");
  let theme = themes.includes(selectedTheme)
    ? selectedTheme
    : themes.includes(themeCookie)
      ? themeCookie
      : lightThemePage
        ? "light"
        : "system";

  const writeCookie = (name, value) => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${name}=${value}; max-age=31536000; path=/; SameSite=Lax${secure}`;
  };
  if (languages.includes(selectedLocale)) writeCookie("user_lang", selectedLocale);
  if (themes.includes(selectedTheme)) writeCookie("dubbingbase-theme", selectedTheme);

  if (languages.includes(selectedLocale) || themes.includes(selectedTheme)) {
    if (languages.includes(selectedLocale)) query.delete("lang");
    if (themes.includes(selectedTheme)) query.delete("theme");
    const search = query.size ? `?${query}` : "";
    history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
  }

  const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
  const applyTheme = () => {
    document.documentElement.dataset.theme =
      theme === "light" || (theme === "system" && systemTheme.matches) ? "light" : "dark";
  };
  applyTheme();

  const updateAuthFallback = () => {
    const link = document.querySelector("a[data-about-auth-fallback]");
    const cookiePrefix = link?.dataset.supabaseCookiePrefix;
    const hasAuthCookie = cookies.some((value) => {
      const name = value.slice(0, value.indexOf("=")).trim();
      return cookiePrefix
        ? name === cookiePrefix || name.startsWith(`${cookiePrefix}.`)
        : name.startsWith("sb-");
    });
    if (!link || !hasAuthCookie) return;

    const profileHref = link.dataset.profileHref;
    const profileLabel = link.dataset.profileLabel;
    if (!profileHref || !profileLabel) return;

    link.href = profileHref;
    link.textContent = profileLabel;
    link.setAttribute("aria-label", profileLabel);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateAuthFallback, { once: true });
  } else {
    updateAuthFallback();
  }

  systemTheme.addEventListener("change", () => {
    if (theme === "system") applyTheme();
  });

  document.addEventListener("click", (clickEvent) => {
    if (!(clickEvent.target instanceof Element)) return;
    const link = clickEvent.target.closest("a[data-about-preference]");
    if (!(link instanceof HTMLAnchorElement)) return;

    const preference = link.dataset.aboutPreference;
    const value = link.dataset.preferenceValue;
    if (preference === "theme" && themes.includes(value)) {
      clickEvent.preventDefault();
      theme = value;
      writeCookie("dubbingbase-theme", theme);
      applyTheme();
      const remainingQuery = new URLSearchParams(location.search);
      remainingQuery.delete("theme");
      const search = remainingQuery.size ? `?${remainingQuery}` : "";
      history.replaceState(null, "", `${location.pathname}${search}${location.hash}`);
    } else if (preference === "lang" && languages.includes(value)) {
      clickEvent.preventDefault();
      writeCookie("user_lang", value);
      const target = link.dataset.preferenceTarget;
      if (target) location.assign(target);
    }
  });

  if (lightThemePage) {
    const prefix = routeLocale === "en" ? "" : `/${routeLocale}`;
    history.replaceState(null, "", `${prefix}/about${location.search}${location.hash}`);
  }

  if (languages.includes(selectedLocale)) {
    const prefix = selectedLocale === "en" ? "" : `/${selectedLocale}`;
    location.replace(`${prefix}/about${location.search}${location.hash}`);
    return;
  }

  const language = cookie("user_lang");
  if (languages.includes(language) && language !== routeLocale) {
    const prefix = language === "en" ? "" : `/${language}`;
    location.replace(`${prefix}/about${location.search}${location.hash}`);
  }
})();
