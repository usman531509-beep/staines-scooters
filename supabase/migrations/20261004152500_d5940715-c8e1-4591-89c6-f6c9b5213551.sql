
REVOKE EXECUTE ON FUNCTION public.adjust_stock_preview(uuid,uuid,numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid,uuid,numeric,text,text,text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decide_stock_adjustment(uuid,boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_stock_approval_threshold(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.receive_stock(uuid,numeric,integer,text,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock_preview(uuid,uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid,uuid,numeric,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_stock_adjustment(uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_stock_approval_threshold(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_stock(uuid,numeric,integer,text,text,date,text) TO authenticated;
