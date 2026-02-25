-- AI Observations: persistent memory for longitudinal pattern intelligence
CREATE TABLE ai_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('daily', 'weekly', 'quarterly')),
  analysis_depth text NOT NULL CHECK (analysis_depth IN ('7day', '30day', 'full')),
  category text NOT NULL,
  observation text NOT NULL,
  date_ref date NOT NULL,
  entity_refs jsonb NOT NULL DEFAULT '[]',
  confidence smallint NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  dismissed boolean NOT NULL DEFAULT false,
  dismiss_reason text CHECK (dismiss_reason IN ('intentional', 'outdated', 'incorrect')),
  dismiss_note text,
  superseded_by uuid REFERENCES ai_observations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index: fetch observations by user + date (for checking if today's analysis ran)
CREATE INDEX idx_ai_observations_user_date ON ai_observations (user_id, date_ref DESC);

-- Index: fetch active observations for injection into AI prompts
CREATE INDEX idx_ai_observations_active ON ai_observations (user_id, scope)
  WHERE superseded_by IS NULL AND dismissed = false;

-- RLS
ALTER TABLE ai_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own observations"
  ON ai_observations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own observations"
  ON ai_observations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own observations"
  ON ai_observations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own observations"
  ON ai_observations FOR DELETE
  USING (auth.uid() = user_id);
