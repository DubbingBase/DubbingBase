import manifest from "#api-v1-manifest";
import { API_SCOPES } from "../../../shared/api-scopes";
import { operationFor, type ApiRouteDocs, type SchemaComponents } from "./define";

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: SchemaComponents = {};
  for (const { route, method, module } of manifest) {
    const docs: ApiRouteDocs | undefined = module.route?.docs;
    if (!docs) continue;
    const path = route.replace(/:(\w+)/g, "{$1}");
    (paths[path] ??= {})[method.toLowerCase()] = operationFor(docs, schemas);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "DubbingBase API",
      version: "1.0.0",
      description: [
        "Admins create a token under Profile → API Key and send it as `Authorization: Bearer dbk_live_…`. " +
          "Every response is `no-store`; errors are `{ error: { code, message } }`. " +
          "Percent-encode non-ASCII query text (`q=Pouss%C3%A9o`): raw UTF-8 in the request line is rejected by the HTTP server before the API sees it. " +
          "Languages are regional codes such as `fr-FR` or `fr-CA`; the allowed values are listed on each `language` field.",
        "## Addressing media",
        "Media lives at `/api/v1/{movies|shows|games|podcasts|audiobooks|advertisements|toys}/{id}`: " +
          "TMDB (movies, shows), IGDB (games), iTunes (podcasts) or Open Library (audiobooks) ids; " +
          "ads and toys use their DubbingBase id. Follow the `path` fields in responses instead of building URLs. " +
          "Media reads, credit batches (including previews) and game character writes require a local DubbingBase record. " +
          "A missing external media record returns `404 not_found` with `Media not imported yet.`. " +
          "Create a dubbing project to register that media before writing characters or credits. " +
          "Unknown ads and toys return `404 not_found` with `Media not found.`. " +
          "Create ads and toys with `POST /advertisements` and `POST /toys`. Cast IDs (`actor_id`) are stored as given.",
        "## Managing dubbing projects",
        "`GET /{type}/{id}` lists the existing projects with their IDs, regional languages and paths. " +
          "Use `POST /{type}/{id}/projects` with a regional `language` to create a project. " +
          'For example, send `{"language":"fr-FR"}` to `POST /games/140617/projects`. ' +
          "This returns an existing project for the same language or creates one, registering the external media reference if needed. " +
          "The API stores provider IDs as supplied without contacting providers. Toys and advertisements must already exist. " +
          "Follow the returned path to `GET /projects/{projectId}` for its details or `PATCH /projects/{projectId}` to set its status or studio.",
        "## Maintaining credits",
        "1. Find the voice actor with `GET /voice-actors?q=` (name search). If they are missing, create them with `POST /voice-actors`: " +
          "a name matching an existing actor (ignoring case, accents and hyphens) is refused with `409 duplicate_candidate` and the matches, " +
          "so use the existing actor, or, for a real homonym, resend with a `tmdb_id`, `wikidata_id` or `date_of_birth` that differs from each match's own " +
          "(an identifier the match lacks proves nothing). An identical name is refused for now. Merging duplicates is website-only.\n" +
          "2. Read what exists: `GET /{type}/{id}` (projects), `GET /{type}/{id}/credits?language=` and " +
          "`GET /{type}/{id}/characters` (character names already used, and a game's registered characters with their IGDB links). " +
          "For a game, register a missing character with `POST /games/{id}/characters` (a name already registered is returned, not duplicated) and " +
          "link it to its IGDB character with `igdb_character_id` or `PATCH /games/{id}/characters/{characterId}`; ids are stored as given, " +
          "so copy them from IGDB. Then reference it as `game_character_id` on credits. Characters that share an actor, such as Taylor and Tanya, are separate characters. " +
          "Reuse existing character names exactly: a credit is identified by media, language, voice actor, cast id and character name.\n" +
          "3. Preview with `POST /{type}/{id}/credits/batch?dry_run=true` (up to 50 credits), which writes nothing and reports `create` or `unchanged` per item; " +
          "a `create` item carries `would_create` (character, voice actor, language, performance, cast ids, highlight).\n" +
          "4. Send the same body without `dry_run`. The batch is all or nothing: if one item is rejected, " +
          "nothing is written and the error names it (`credits.2`). Sending a batch again is safe: roles that exist come back `unchanged`. " +
          "If you leave `game_character_id` out and one credit with that name, voice actor and cast id is already linked to a game character, it comes back `unchanged` with that `linked_game_character_id` and nothing is added; several such credits give 409 `ambiguous_credit`.\n" +
          "5. Fix a credit in place with `PATCH /{type}/{id}/credits/{workId}`: `performance`, `character_name`, `actor_id`, `game_character_id` and `highlight` (send only what changes). `highlight: true` marks a main character, who is listed first on the game page; on a batch `create` item it flags the credit being created, never one that already exists. " +
          "This is how to complete a credit that has no character name: it keeps its id, history and review state. " +
          "A batch item for a voice actor who already has a nameless credit with the same cast id is refused with 409 `nameless_credit_exists` naming that credit, so complete it with PATCH. " +
          "The API cannot delete credits; leave that to the website.",
        "## Rules",
        "Writes behave as if the token's owner made them. Credits carry a `reviewed_status`: `waiting` (added by someone " +
          "who is not trusted for that voice actor, pending an editor's verification), `accepted` (verified) or `rejected`. " +
          "Tokens belong to admins, who are trusted, so credits the API adds are `accepted` straight away, while changing a credit with PATCH keeps its status; the API returns credits of every status; " +
          "no separate review step applies to API writes. Each change is " +
          "audited as made through the API and reported to the DubbingBase admins. " +
          "A credit for a language with no dubbing project yet creates that project. " +
          "Characters are free text, except games, where `game_character_id` may reference a registered character " +
          "(use either `actor_id` or `game_character_id`, not both). Only add credits you can source; " +
          "do not guess names or ids.",
      ].join("\n\n"),
    },
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: `Personal API token. Scopes (resource:read, create or update): ${API_SCOPES.join(", ")}.`,
        },
      },
    },
  };
}
