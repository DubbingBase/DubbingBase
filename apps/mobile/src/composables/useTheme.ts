import { ref } from 'vue';

const currentTheme = ref('theme-dark');

export function useTheme() {
  const initTheme = () => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) {
      currentTheme.value = savedTheme;
    } else {
      currentTheme.value = window.matchMedia('(prefers-color-scheme: light)').matches ? 'theme-light' : 'theme-dark';
    }
    applyTheme();
  };

  const setTheme = (themeName: string) => {
    currentTheme.value = themeName;
    localStorage.setItem('app-theme', themeName);
    applyTheme();
  };

  const toggleTheme = () => {
    setTheme(currentTheme.value === 'theme-dark' ? 'theme-light' : 'theme-dark');
  };

  const applyTheme = () => {
    // Remove all classes starting with 'theme-'
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '').trim();
    // Add the current theme class
    document.body.classList.add(currentTheme.value);
  };

  return {
    currentTheme,
    setTheme,
    toggleTheme,
    initTheme,
  };
}
