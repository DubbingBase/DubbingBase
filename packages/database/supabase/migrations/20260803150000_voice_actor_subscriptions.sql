CREATE TABLE IF NOT EXISTS public.voice_actor_subscriptions (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    voice_actor_id BIGINT NOT NULL REFERENCES public.voice_actors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, voice_actor_id)
);

ALTER TABLE public.voice_actor_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
    ON public.voice_actor_subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions"
    ON public.voice_actor_subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
    ON public.voice_actor_subscriptions
    FOR DELETE
    USING (auth.uid() = user_id);
