import MessageItem from './MessageItem';
import type { Message } from '@/types';

interface MessageGroupProps {
  userId: string;
  messages: Message[];
}

export default function MessageGroup({ messages }: MessageGroupProps) {
  return (
    <div>
      {messages.map((msg, i) => (
        <MessageItem key={msg.id} message={msg} showHeader={i === 0} />
      ))}
    </div>
  );
}
