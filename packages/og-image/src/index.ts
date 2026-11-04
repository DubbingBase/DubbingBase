import { voiceActorGenerator, type VoiceActorOgParams } from "./voice-actor.ts";

export type GeneratorType = "voice-actor";

export interface GenerateOptions {
  type: GeneratorType;
  params: VoiceActorOgParams;
}

export function generateTemplate(options: GenerateOptions) {
  switch (options.type) {
    case "voice-actor":
      return voiceActorGenerator(options.params);
    default:
      throw new Error(`Unknown generator type: ${options.type}`);
  }
}

export { voiceActorGenerator, type VoiceActorOgParams };
