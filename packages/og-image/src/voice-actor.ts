import { html } from "npm:satori-html";

export interface VoiceActorOgParams {
  name: string;
  image: string;
  worksCount: number;
}

export function voiceActorGenerator(params: VoiceActorOgParams) {
  return html`
    <div style="display: flex; flex-direction: column; width: 1200px; height: 630px; background-color: #111827; color: white; font-family: 'Inter'; padding: 60px; justify-content: center; align-items: center;">
      <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
        <div style="display: flex; flex-direction: column; align-items: center; border-radius: 32px; background-color: #1f2937; padding: 40px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); width: 800px; border: 2px solid #374151;">
          <img src="${params.image}" style="width: 200px; height: 200px; border-radius: 100px; object-fit: cover; margin-bottom: 24px; border: 4px solid #4b5563;" />
          <h1 style="font-size: 64px; font-weight: 800; margin: 0; color: #f3f4f6; text-align: center;">${params.name}</h1>
          <p style="font-size: 32px; color: #9ca3af; margin-top: 16px; margin-bottom: 0;">Voice Actor • ${params.worksCount} Works</p>
        </div>
      </div>
    </div>
  `;
}
