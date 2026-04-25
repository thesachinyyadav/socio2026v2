-- 032_feedbacks.sql
-- Post-event feedback system: feedbacks table + feedback_sent_at on events

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS feedback_sent_at timestamptz;

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  reg_no text NOT NULL,
  data jsonb NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  CONSTRAINT feedbacks_event_reg_no UNIQUE (event_id, reg_no),
  CONSTRAINT fk_feedbacks_event FOREIGN KEY (event_id)
    REFERENCES public.events(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_event_id ON public.feedbacks(event_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_reg_no ON public.feedbacks(reg_no);
