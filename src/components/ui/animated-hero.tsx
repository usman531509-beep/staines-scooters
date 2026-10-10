import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * A line of text that cycles through `words`, each one sliding up into place.
 * Every word is in the server HTML (for SEO and no-JS); only the active one is shown.
 */
function RotatingWords({
  words,
  interval = 2400,
  className,
}: {
  words: readonly string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || words.length < 2) return;
    const id = setTimeout(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => clearTimeout(id);
  }, [index, interval, reduceMotion, words.length]);

  return (
    <span className={cn("relative block overflow-hidden", className)}>
      {/* Invisible copy of the longest word reserves the line's width and height. */}
      <span aria-hidden="true" className="invisible block whitespace-nowrap">
        {words.reduce((a, b) => (b.length > a.length ? b : a), "")}
      </span>
      {words.map((word, i) => (
        <motion.span
          key={word}
          className="absolute left-0 top-0 whitespace-nowrap"
          aria-hidden={i !== index}
          initial={false}
          transition={{ type: "spring", stiffness: 60, damping: 14 }}
          animate={
            i === index
              ? { y: "0%", opacity: 1 }
              : { y: i < index ? "-110%" : "110%", opacity: 0 }
          }
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

export { RotatingWords };
