-- Guarda os itens do carrinho antes de a DFD ser formalizada. A operação é
-- atômica para não sobrescrever groupForms ou outras chaves do payload.
CREATE OR REPLACE FUNCTION public.save_dfd_draft_cart(p_cart_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF jsonb_typeof(p_cart_items) <> 'array' THEN
    RAISE EXCEPTION 'p_cart_items must be a JSON array';
  END IF;

  INSERT INTO public.dfd_drafts (user_id, payload, schema_version, current_step, expires_at)
  VALUES (
    current_user_id,
    jsonb_build_object('cartItems', p_cart_items),
    1,
    NULL,
    timezone('utc'::text, now()) + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    payload = jsonb_set(
      COALESCE(public.dfd_drafts.payload, '{}'::jsonb),
      '{cartItems}',
      EXCLUDED.payload -> 'cartItems',
      true
    ),
    schema_version = 1,
    expires_at = timezone('utc'::text, now()) + INTERVAL '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.save_dfd_draft_cart(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_dfd_draft_cart(JSONB) TO authenticated;
