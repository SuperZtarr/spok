import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };

// ---------------------------------------------------------------------------
// Base helper
// ---------------------------------------------------------------------------
function Bg({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <>
      <rect width="24" height="24" rx="4" fill={color} />
      {children}
    </>
  );
}

// ---------------------------------------------------------------------------
// Microsoft Word — .doc .docx .odt .rtf
// ---------------------------------------------------------------------------
export function WordIcon({ size = 24, className, style, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style} {...props}>
      <Bg color="#185ABD">
        <path d="M5 8L7.5 17L10 11.5L12.5 17L15 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 8L19 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 12L19 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 16L19 16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </Bg>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Microsoft Excel — .xls .xlsx .ods .csv .tsv
// ---------------------------------------------------------------------------
export function ExcelIcon({ size = 24, className, style, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style} {...props}>
      <Bg color="#107C41">
        {/* grid */}
        <rect x="5" y="7" width="14" height="10" rx="1" stroke="white" strokeWidth="1.3" fill="none" />
        <line x1="5" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.3" />
        <line x1="12" y1="7" x2="12" y2="17" stroke="white" strokeWidth="1.3" />
      </Bg>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Microsoft PowerPoint — .ppt .pptx .odp .key
// ---------------------------------------------------------------------------
export function PowerPointIcon({ size = 24, className, style, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style} {...props}>
      <Bg color="#C43E1C">
        {/* slide shape */}
        <rect x="5" y="7" width="14" height="10" rx="1.5" stroke="white" strokeWidth="1.3" fill="none" />
        {/* P letter */}
        <path d="M9 10.5V14.5M9 10.5H12C13.1 10.5 13.5 11 13.5 11.8C13.5 12.6 13.1 13 12 13H9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </Bg>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// PDF — .pdf
// ---------------------------------------------------------------------------
export function PdfIcon({ size = 24, className, style, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={style} {...props}>
      <Bg color="#E53333">
        {/* page shape */}
        <rect x="5" y="5" width="10" height="13" rx="1.5" stroke="white" strokeWidth="1.3" fill="none" />
        <path d="M11 5v4h4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* PDF label */}
        <text x="19" y="18" textAnchor="end" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif" fill="white">PDF</text>
      </Bg>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Utility: given a file URL, return the branded icon component or null
// (null = fall back to Lucide icon)
// ---------------------------------------------------------------------------
export function getOfficeFileIcon(url: string): React.ComponentType<IconProps> | null {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf') return PdfIcon;
  if (['doc', 'docx', 'odt', 'rtf'].includes(ext)) return WordIcon;
  if (['xls', 'xlsx', 'ods', 'csv', 'tsv'].includes(ext)) return ExcelIcon;
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return PowerPointIcon;

  return null;
}
