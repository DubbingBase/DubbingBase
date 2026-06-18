import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { data, error } = await ctx.supabaseAdmin.auth.admin.listUsers();
    if (error) {
      return Response.json({ error }, { status: 500 });
    }
    return Response.json({ users: data.users });
  }),
};
