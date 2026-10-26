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
  const query = new URLSearchParams(location.search);
  const selectedLocale = query.get("lang");
  const selectedTheme = query.get("theme");
  const themeCookie = cookie("dubbingbase-theme");
  let theme = themes.includes(selectedTheme)
    ? selectedTheme
    : themes.includes(themeCookie)
      ? themeCookie
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
      writeCookie("user_lang", value);
    }
  });

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
