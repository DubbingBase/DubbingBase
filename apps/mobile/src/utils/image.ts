export const getAvatarFallbackUrl = (name: string): string => {
  return `https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${encodeURIComponent(name || "Unknown")}`;
};
