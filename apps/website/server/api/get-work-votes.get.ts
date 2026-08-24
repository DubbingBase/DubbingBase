import { getWorkVotes } from "../utils/db/queries";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawWorkIds = query.work_ids as any;

  let workIds: number[] = [];

  if (Array.isArray(rawWorkIds)) {
    workIds = rawWorkIds.map(Number).filter((n) => !isNaN(n));
  } else if (typeof rawWorkIds === "string") {
    workIds = rawWorkIds
      .split(",")
      .map((s: string) => Number(s.trim()))
      .filter((n: number) => !isNaN(n));
  } else if (typeof rawWorkIds === "number") {
    workIds = [rawWorkIds];
  }

  if (workIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid work_ids array",
    });
  }

  try {
    const user = event.context.user;
    let voteData;
    if (user) {
      voteData = await getWorkVotes(workIds, user.id);
    } else {
      voteData = await getWorkVotes(workIds);
    }
    return voteData;
  } catch (error) {
    console.error("Error in get-work-votes route:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
