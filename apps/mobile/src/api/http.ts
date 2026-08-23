import { ofetch } from "ofetch";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "";

globalThis.$fetch = ofetch.create({
  baseURL: apiBaseUrl,
}) as typeof globalThis.$fetch;

export {};
