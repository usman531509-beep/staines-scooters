
-- Add new offer types for category-level discounts
ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'percent_off_category';
ALTER TYPE public.offer_type ADD VALUE IF NOT EXISTS 'fixed_off_category';

-- Removed: back-fill of the previous business's fixed monthly expenses.
