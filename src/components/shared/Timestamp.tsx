import { formatMessageTime } from '@/utils/format-time';

interface TimestampProps {
  isoString: string;
}

export default function Timestamp({ isoString }: TimestampProps) {
  return (
    <span className="text-xs text-muted-foreground whitespace-nowrap">
      {formatMessageTime(isoString)}
    </span>
  );
}
