export interface AccessControlConfig {
  key: string;
  name: string;
  description: string;
}

export const PERMISSIONS = [
  {
    key: "add_voice_actors",
    name: "Add Voice Actors",
    description: "Permission to add voice actors to the system",
  },
  {
    key: "admin_fetch",
    name: "Admin Fetch",
    description: "Permission to fetch information as an admin",
  },
  {
    key: "edit_voice_actor_link",
    name: "Edit Voice Actor Link",
    description: "Permission to edit voice actor links",
  },

  {
    key: "delete_voice_actor_link",
    name: "Delete Voice Actor Link",
    description: "Permission to delete voice actor links",
  },
] as const satisfies AccessControlConfig[];

export type Permission = (typeof PERMISSIONS)[number]["key"];

export const FEATURE_FLAGS = [
  {
    key: "ai-scanner",
    name: "Advanced Search",
    description: "Access to advanced search capabilities",
  },
] as const satisfies AccessControlConfig[];

export type FeatureFlag = (typeof FEATURE_FLAGS)[number]["key"];
