-- Per-day chat messages for AI coach panel
CREATE TABLE public.daily_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_user_date ON public.daily_chat_messages(user_id, date);
ALTER TABLE public.daily_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own chat messages"
  ON public.daily_chat_messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
