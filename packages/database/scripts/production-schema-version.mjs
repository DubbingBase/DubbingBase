// Prints the newest migration version applied on the remote project, read from the JSON that
// `supabase migration list` prints when its output is not a terminal. Used by `mise run reseed`.
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  const parsed = JSON.parse(input.slice(start, end + 1));
  const applied = parsed.migrations
    .map((migration) => migration.remote)
    .filter((version) => typeof version === "string" && version.length > 0)
    .sort();
  const newest = applied.at(-1);
  if (newest === undefined) {
    console.error("The remote project reports no applied migrations");
    process.exit(1);
  }
  console.log(newest);
});
