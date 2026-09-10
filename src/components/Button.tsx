import type { ComponentChildren } from "preact";
import type { AnchorHTMLAttributes } from "preact";
import clsx from "clsx";

export type ButtonProps = {
  children: ComponentChildren;
  href?: string;
  class?: string;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

export default function Button({
  children,
  href,
  class: className,
  ...props
}: ButtonProps) {
  const Tag = (href ? "a" : "button") as any;

  return (
    <Tag href={href} class={clsx("button", className)} {...props}>
      {children}
    </Tag>
  );
}
