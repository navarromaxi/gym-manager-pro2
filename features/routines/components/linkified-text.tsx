import { Fragment } from "react";

const urlPattern = /(https?:\/\/[^\s]+)/g;

export function LinkifiedText({ value, className }: { value: string; className?: string }) {
  return <span className={className}>{value.split(urlPattern).map((part, index) => /^https?:\/\//i.test(part) ? <a key={index} href={part} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900">Abrir enlace</a> : <Fragment key={index}>{part}</Fragment>)}</span>;
}
