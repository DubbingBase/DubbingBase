import { readFile, writeFile } from "node:fs/promises";

const filePath = new URL("../src/database.types.ts", import.meta.url);
// These SQL functions intentionally accept NULL for the listed arguments,
// while Supabase CLI generates every declared function argument as non-null.
// Keep this map narrow and fail if a generated signature changes.
const nullableArguments = {
  controlled_save_studio: {
    p_expected_updated_at: "string",
    p_studio_id: "number",
  },
  controlled_save_toy_metadata: {
    p_expected_updated_at: "string",
  },
  find_or_create_dubbing_project: {
    p_voice_actor_id: "number",
  },
  find_work_role_identity_matches: {
    p_character_id: "number",
    p_character_name: "string",
  },
};

let types = await readFile(filePath, "utf8");

for (const [functionName, argumentTypes] of Object.entries(nullableArguments)) {
  const functionPattern = new RegExp(
    `(^      ${functionName}: \\{\\n        Args: \\{\\n)([\\s\\S]*?)(\\n        \\};)`,
    "m",
  );
  const functionMatch = functionPattern.exec(types);

  if (!functionMatch) {
    throw new Error(`Generated types do not contain ${functionName}.Args.`);
  }

  let args = functionMatch[2];

  for (const [argumentName, expectedType] of Object.entries(argumentTypes)) {
    const argumentPattern = new RegExp(
      `^(\\s+${argumentName}: )([^;]+);$`,
      "m",
    );
    const argumentMatch = argumentPattern.exec(args);

    if (!argumentMatch || argumentMatch[2] !== expectedType) {
      throw new Error(
        `Expected ${functionName}.${argumentName} to be generated as ${expectedType}.`,
      );
    }

    args = args.replace(argumentPattern, `$1${expectedType} | null;`);
  }

  types = [
    types.slice(0, functionMatch.index),
    functionMatch[1],
    args,
    functionMatch[3],
    types.slice(functionMatch.index + functionMatch[0].length),
  ].join("");
}

await writeFile(filePath, types);
