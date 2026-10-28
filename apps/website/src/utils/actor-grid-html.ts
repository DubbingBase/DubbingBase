import type { ActorResponse } from "@app/shared-logic";

type ActorVoiceActor =
  ActorResponse["actor"]["voice_roles"][number]["voice_actors"][number];
type ActorCredit = ActorResponse["actor"]["credits"]["cast"][number];

export type ActorVoiceActorCard = Pick<
  ActorVoiceActor,
  "id" | "firstname" | "lastname" | "profile_picture"
> & {
  rolesCount: number;
};

export type ActorFilmographyCard = ActorCredit & {
  voice_actors?: Array<
    Pick<ActorVoiceActor, "id" | "firstname" | "lastname" | "profile_picture">
  >;
};

export interface ActorImageAttributes {
  "data-nuxt-img": "";
  onerror?: string;
  alt: string | undefined;
  class: string;
  decoding: "async";
  loading: "lazy";
  src: string;
}

export type ActorImageAttributesFactory = (
  src: string | null | undefined,
  alt: string | undefined,
  imageClass: string,
) => ActorImageAttributes;

export interface ActorFilmographyCopy {
  voicedBy: string;
  as: string;
  unknownCharacter: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const CLAPPERBOARD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"><path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="m4 11 2-7"/><path d="m10 11 2-7"/><path d="m16 11 2-7"/><path d="M2 15h20"/></svg>';

const USER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>';

export function escapeActorHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? character,
  );
}

export function renderActorImageHtml(attributes: ActorImageAttributes): string {
  const onerror =
    attributes.onerror === undefined
      ? ""
      : ` onerror="${escapeActorHtml(attributes.onerror)}"`;
  const alt =
    attributes.alt === undefined
      ? ""
      : ` alt="${escapeActorHtml(attributes.alt)}"`;

  return `<img data-nuxt-img=""${onerror}${alt} class="${escapeActorHtml(attributes.class)}" decoding="async" loading="lazy" src="${escapeActorHtml(attributes.src)}">`;
}

export function renderActorVoiceActorCardHtml(
  actor: ActorVoiceActorCard,
  href: string,
  rolesLabel: string,
  getImageAttributes: ActorImageAttributesFactory,
): string {
  const name = `${actor.firstname} ${actor.lastname}`;
  const initials = actor.profile_picture
    ? ""
    : escapeActorHtml(`${actor.firstname[0] ?? ""}${actor.lastname[0] ?? ""}`);
  const image = actor.profile_picture
    ? renderActorImageHtml(
        getImageAttributes(
          actor.profile_picture,
          name,
          "object-cover w-full h-full",
        ),
      )
    : `<div class="w-full h-full flex items-center justify-center theme-surface-raised theme-surface-muted theme-text-muted font-bold">${initials}</div>`;

  return `<a data-actor-nav="" href="${escapeActorHtml(href)}" class="flex flex-col items-center p-4 rounded-xl border transition group hover:-translate-y-1 theme-input theme-border-subtle theme-border theme-hover-surface-muted"><div class="relative w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-transparent theme-hover-primary-border transition-colors">${image}</div><span class="block font-bold text-center text-sm theme-text">${escapeActorHtml(name)}</span><span class="text-xs theme-text-muted mt-1">${actor.rolesCount}${escapeActorHtml(rolesLabel)}</span></a>`;
}

export function renderActorFilmographyCardHtml(
  item: ActorFilmographyCard,
  mediaHref: string,
  voiceActorHref: string | undefined,
  copy: ActorFilmographyCopy,
  getImageAttributes: ActorImageAttributesFactory,
  resolveImageUrl: (path: string | null | undefined) => string | undefined,
): string {
  const title = item.title || item.name || "";
  const escapedTitle = escapeActorHtml(title);
  const releaseYear = item.release_date
    ? new Date(item.release_date).getFullYear()
    : item.first_air_date
      ? new Date(item.first_air_date).getFullYear()
      : "N/A";
  const mediaImage = item.poster_path
    ? renderActorImageHtml(
        getImageAttributes(
          resolveImageUrl(item.poster_path),
          title,
          "w-full h-full object-cover transition-transform duration-300",
        ),
      )
    : `<div class="w-full h-full flex items-center justify-center theme-text-muted">${CLAPPERBOARD_ICON}</div>`;
  const voiceActor = item.voice_actors?.[0];
  const voiceActorName = voiceActor
    ? `${voiceActor.firstname} ${voiceActor.lastname}`
    : "";
  const escapedVoiceActorName = voiceActor
    ? escapeActorHtml(voiceActorName)
    : "";
  const voiceActorInitials =
    voiceActor && !voiceActor.profile_picture
      ? escapeActorHtml(
          `${voiceActor.firstname[0] ?? ""}${voiceActor.lastname[0] ?? ""}`,
        )
      : "";
  const voiceActorContent = voiceActor
    ? `<a data-actor-nav="" href="${escapeActorHtml(voiceActorHref ?? "")}" class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0 hover:opacity-80 transition-opacity cursor-pointer"><div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0">${voiceActor.profile_picture ? renderActorImageHtml(getImageAttributes(voiceActor.profile_picture, voiceActorName, "w-full h-full object-cover")) : `<div class="w-full h-full flex items-center justify-center theme-text-muted text-xs font-bold theme-surface-raised theme-input"><span>${voiceActorInitials}</span></div>`}</div><div class="flex flex-col min-w-0 flex-1"><span class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5">${escapeActorHtml(copy.voicedBy)}</span><span class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2">${escapedVoiceActorName}</span></div></a>`
    : `<div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"><div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"><div class="w-full h-full flex items-center justify-center theme-text-muted text-xs font-bold theme-surface-raised theme-input">${USER_ICON}</div></div><div class="flex flex-col min-w-0 flex-1"><span class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5">${escapeActorHtml(copy.voicedBy)}</span><span class="font-medium text-sm theme-text-muted italic">${escapeActorHtml(copy.unknownCharacter)}</span></div></div>`;

  return `<div class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border block group"><div class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full"><a data-actor-nav="" href="${escapeActorHtml(mediaHref)}" class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start hover:opacity-80 transition-opacity cursor-pointer"><div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0">${mediaImage}</div><div class="flex flex-col min-w-0 flex-1"><span class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5">${escapeActorHtml(String(releaseYear))}</span><span class="font-bold text-sm theme-text leading-tight line-clamp-2" title="${escapedTitle}">${escapedTitle}</span></div></a>${voiceActorContent}<div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"><div class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 relative flex-shrink-0"><div class="w-full h-full flex items-center justify-center theme-text-muted">${USER_ICON}</div></div><div class="flex flex-col min-w-0 flex-1"><span class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5">${escapeActorHtml(copy.as)}</span><span class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2">${escapeActorHtml(item.character || copy.unknownCharacter)}</span></div></div></div></div>`;
}
