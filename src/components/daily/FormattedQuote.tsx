'use client';

// 列表/预览中的富文本渲染：【】高亮块、~~下划线~~
import { parseContent } from '@/lib/text-parser';

export function FormattedQuote({
  content,
  className = '',
}: {
  content: string;
  className?: string;
}) {
  const paras = parseContent(content);
  return (
    <div className={className}>
      {paras.map((segs, pi) => (
        <p key={pi} className={pi > 0 ? 'mt-2' : ''}>
          {segs.map((s, si) => {
            if (s.style === 'highlight') {
              return (
                <span key={si} className="q-mark">
                  {s.text}
                </span>
              );
            }
            if (s.style === 'underline') {
              return (
                <span key={si} className="q-ul">
                  {s.text}
                </span>
              );
            }
            return <span key={si}>{s.text}</span>;
          })}
        </p>
      ))}
    </div>
  );
}
