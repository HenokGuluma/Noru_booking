const PATHS: Record<string, string> = {
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-14v5l3.5 2',
  users: 'M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm9 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c.6-3.6 3.2-6 6-6s5.4 2.4 6 6M15 14c2.4.2 4.4 2.3 5 6',
  umbrella: 'M12 3c-4.4 0-8 3.4-8 8h16c0-4.6-3.6-8-8-8Zm0 0v16.5a2 2 0 0 1-4 0M4 20h16',
  banknote: 'M3 7h18v10H3V7Zm5 5a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm-3-1v2m14-2v2',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  route: 'M5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm14 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 9v3a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4',
  tag: 'M12 3h6a2 2 0 0 1 2 2v6l-9 9-8-8 9-9Zm4 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z',
  scale: 'M12 3v18M8 21h8M5 7l-3 6a3 3 0 0 0 6 0l-3-6Zm14 0-3 6a3 3 0 0 0 6 0l-3-6ZM5 7h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35',
  x: 'M18 6 6 18M6 6l12 12',
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
