import type { Component } from "vue";
import {
  BookOpen as BookOpenIcon,
  Film as FilmIcon,
  Gamepad2 as Gamepad2Icon,
  Megaphone as MegaphoneIcon,
  Mic as MicIcon,
  Radio as RadioIcon,
  Smile as SmileIcon,
  Tv as TvIcon,
  User as UserIcon,
} from "lucide-vue-next";
import type { SearchResult } from "@app/shared-logic";

export type SearchMediaType = SearchResult["media_type"];

export const searchTypeIcons: Record<SearchMediaType, Component> = {
  movie: FilmIcon,
  tv: TvIcon,
  person: UserIcon,
  voice_actor: MicIcon,
  video_game: Gamepad2Icon,
  audiobook: BookOpenIcon,
  podcast: RadioIcon,
  advertisement: MegaphoneIcon,
  toy: SmileIcon,
};

export const searchTypeColors: Record<SearchMediaType, string> = {
  movie: "text-[var(--app-color-search-movie)]",
  tv: "text-[var(--app-color-search-tv)]",
  person: "text-[var(--app-color-search-person)]",
  voice_actor: "text-[var(--app-color-search-voice-actor)]",
  video_game: "text-[var(--app-color-search-video-game)]",
  audiobook: "text-[var(--app-color-search-audiobook)]",
  podcast: "text-[var(--app-color-search-podcast)]",
  advertisement: "text-[var(--app-color-search-advertisement)]",
  toy: "text-[var(--app-color-search-toy)]",
};

/** Display order shared by the search filter chips and the home search dropdown. */
export const searchTypeOptions: SearchMediaType[] = [
  "movie",
  "tv",
  "person",
  "voice_actor",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
];

export const searchTypeLabelKeys: Record<SearchMediaType, string> = {
  movie: "search.movie",
  tv: "search.tv",
  person: "search.actor",
  voice_actor: "search.voiceActor",
  video_game: "search.videoGame",
  audiobook: "search.audiobook",
  podcast: "search.podcast",
  advertisement: "search.advertisement",
  toy: "search.toy",
};
