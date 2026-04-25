-- 033_feedbacks_restructure.sql
-- Restructure feedbacks: one row per event, all submissions stored in a single jsonb blob.
-- Schema: { "reg_no": [q1, q2, q3, q4, q5], ... }

DROP TABLE IF EXISTS public.feedbacks;

CREATE TABLE public.feedbacks (
  id        uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  text  NOT NULL UNIQUE,
  data      jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT fk_feedbacks_event FOREIGN KEY (event_id)
    REFERENCES public.events(event_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_feedbacks_event_id ON public.feedbacks(event_id);
