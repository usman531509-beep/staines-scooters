CREATE OR REPLACE FUNCTION public.award_referral_points_after_first_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id uuid;
  was_rewarded boolean := false;
  referrer_card record;
  referred_card record;
  sale_count integer := 0;
  reward_points integer := 10;
  new_referrer_balance integer;
  new_referred_balance integer;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT referred_by, referral_rewarded, COALESCE(referral_reward_points, 10)
    INTO referrer_id, was_rewarded, reward_points
  FROM public.profiles
  WHERE id = NEW.user_id;

  IF referrer_id IS NULL OR was_rewarded THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
    INTO sale_count
  FROM public.sales
  WHERE user_id = NEW.user_id;

  IF sale_count <> 1 THEN
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET referral_rewarded = true
  WHERE id = NEW.user_id
    AND referral_rewarded = false;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO referrer_card
  FROM public.loyalty_cards
  WHERE user_id = referrer_id
  LIMIT 1;

  SELECT * INTO referred_card
  FROM public.loyalty_cards
  WHERE user_id = NEW.user_id
  LIMIT 1;

  IF referrer_card.id IS NOT NULL THEN
    new_referrer_balance := COALESCE(referrer_card.points_balance, 0) + reward_points;
    UPDATE public.loyalty_cards
    SET points_balance = new_referrer_balance,
        lifetime_points = COALESCE(lifetime_points, 0) + reward_points
    WHERE id = referrer_card.id;

    INSERT INTO public.point_transactions (card_id, user_id, tx_type, points, reason, sale_id, balance_after)
    VALUES (referrer_card.id, referrer_id, 'earn', reward_points, 'Referral reward after first purchase', NEW.id, new_referrer_balance);
  END IF;

  IF referred_card.id IS NOT NULL THEN
    new_referred_balance := COALESCE(referred_card.points_balance, 0) + reward_points;
    UPDATE public.loyalty_cards
    SET points_balance = new_referred_balance,
        lifetime_points = COALESCE(lifetime_points, 0) + reward_points
    WHERE id = referred_card.id;

    INSERT INTO public.point_transactions (card_id, user_id, tx_type, points, reason, sale_id, balance_after)
    VALUES (referred_card.id, NEW.user_id, 'earn', reward_points, 'Referral signup reward after first purchase', NEW.id, new_referred_balance);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.award_referral_points_after_first_sale() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_referral_points_after_first_sale() FROM anon;
REVOKE ALL ON FUNCTION public.award_referral_points_after_first_sale() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.award_referral_points_after_first_sale() TO service_role;