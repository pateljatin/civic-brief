interface SourceLinkProps {
  url: string;
  title?: string;
  isDemo?: boolean;
}

export default function SourceLink({ url, title, isDemo = false }: SourceLinkProps) {
  // Extract a readable domain from the URL
  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {
    domain = url;
  }

  const label = title ? `Verify: ${title}` : `Verify at ${domain}`;

  const baseStyle = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    padding: '10px 16px',
    borderRadius: '10px',
    border: '1px solid var(--border, #e2ddd4)',
    fontSize: '14px',
    fontWeight: 500,
    textDecoration: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  };

  const icon = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M6.5 3.5H3.5C2.948 3.5 2.5 3.948 2.5 4.5V12.5C2.5 13.052 2.948 13.5 3.5 13.5H11.5C12.052 13.5 12.5 13.052 12.5 12.5V9.5M9.5 2.5H13.5M13.5 2.5V6.5M13.5 2.5L7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (isDemo) {
    return (
      <button
        disabled
        title="This is a demo brief. Upload a real document to verify sources."
        style={{
          ...baseStyle,
          background: '#f5f5f5',
          color: '#aaa',
          cursor: 'not-allowed',
          opacity: 0.6,
        }}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        ...baseStyle,
        background: 'white',
        color: 'var(--civic, #1e3a5f)',
      }}
    >
      {icon}
      {label}
    </a>
  );
}
