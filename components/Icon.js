const paths = {
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  down: <path d="m7 10 5 5 5-5" />,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.55-1L20 9M4 15l2.35 3A7 7 0 0 0 17.9 17" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></>,
  support: <><path d="M20 11.5a8 8 0 0 1-8 8H4l1.5-4A8 8 0 1 1 20 11.5Z" /><path d="M8 10h8M8 14h5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3L2.8 9.7l6.4-.9Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.5" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  alert: <><path d="m12 3 10 17H2L12 3Z" /><path d="M12 9v5m0 3v.2" /></>,
};
export default function Icon({ name, size = 18, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.grid}</svg>;
}
export function CatMark() {
  return <svg width="25" height="25" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M5 14V5l8 5a17 17 0 0 1 6 0l8-5v9c2 3 2 7-1 10-4 4-16 4-20 0-3-3-3-7-1-10Z" fill="currentColor" /><path d="M11 17v2m10-2v2m-7 3 2 1 2-1" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" /></svg>;
}
