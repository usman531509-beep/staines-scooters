-- Normalise existing UK phone numbers to local `07…` format by stripping leading +44 / 0044 / 44 country code.
UPDATE public.profiles
SET phone = CASE
  WHEN regexp_replace(phone, '[^0-9+]', '', 'g') LIKE '+44%'  THEN '0' || substring(regexp_replace(phone, '[^0-9+]', '', 'g') FROM 4)
  WHEN regexp_replace(phone, '[^0-9+]', '', 'g') LIKE '0044%' THEN '0' || substring(regexp_replace(phone, '[^0-9+]', '', 'g') FROM 5)
  WHEN regexp_replace(phone, '[^0-9+]', '', 'g') LIKE '44%'
       AND length(regexp_replace(phone, '[^0-9+]', '', 'g')) >= 12 THEN '0' || substring(regexp_replace(phone, '[^0-9+]', '', 'g') FROM 3)
  ELSE regexp_replace(phone, '[^0-9+]', '', 'g')
END
WHERE phone IS NOT NULL
  AND phone <> '';