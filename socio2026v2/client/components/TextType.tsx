"use client";

import { ElementType, useMemo } from "react";

type TextValue = string | string[];

type TextTypeProps<T extends ElementType = "span"> = {
  as?: T;
  text: TextValue;
  className?: string;
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  loop?: boolean;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorClassName?: string;
};

export default function TextType<T extends ElementType = "span">({
  as,
  text,
  className,
  showCursor = false,
  cursorCharacter = "|",
  cursorClassName,
}: TextTypeProps<T>) {
  const Component = (as || "span") as ElementType;
  const resolvedText = useMemo(() => {
    if (Array.isArray(text)) {
      return text.find((entry) => String(entry).trim().length > 0) ?? "";
    }
    return text ?? "";
  }, [text]);

  return (
    <Component className={className}>
      {resolvedText}
      {showCursor ? <span className={cursorClassName}>{cursorCharacter}</span> : null}
    </Component>
  );
}
