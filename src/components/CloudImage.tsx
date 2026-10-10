import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSignedProductImageUrl } from "@/lib/storage.functions";

export function CloudImage({
  src,
  alt,
  className,
  fallback,
  loading = "lazy",
  decoding = "async",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback: ReactNode;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
}) {
  const signImage = useServerFn(getSignedProductImageUrl);
  const rawSrc = typeof src === "string" ? src.trim() : "";
  const needsSigning = !!rawSrc && !/^(https?:|data:|blob:|\/)/i.test(rawSrc);
  const [broken, setBroken] = useState(false);

  useEffect(() => setBroken(false), [rawSrc]);

  const { data: signedSrc } = useQuery({
    queryKey: ["signed-product-image", rawSrc],
    queryFn: () => signImage({ data: { path: rawSrc } }),
    enabled: needsSigning,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  const finalSrc = needsSigning ? signedSrc : rawSrc;

  if (!finalSrc || broken) return <>{fallback}</>;

  return (
    <img
      src={finalSrc}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}