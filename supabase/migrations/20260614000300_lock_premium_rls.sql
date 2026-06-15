ALTER TABLE public.premium_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_expression_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published premium sessions are readable."
  ON public.premium_sessions;

DROP POLICY IF EXISTS "Published premium expression cards are readable."
  ON public.premium_expression_cards;

DROP POLICY IF EXISTS "Published premium articles are readable."
  ON public.premium_articles;

-- Premium content is served through /api/premium/* so trial and subscription
-- entitlement can be checked server-side before service-role reads.
