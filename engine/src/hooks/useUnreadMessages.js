import { useEffect, useState } from "react";
import { conversationUnread, subscribeConversations } from "../services/chat";

/**
 * Total de mensagens não lidas do usuário — alimenta os badges da navegação.
 * O contador só é zerado por derivação (quando não há usuário) para não
 * disparar setState síncrono dentro do efeito.
 */
export function useUnreadMessages(userId) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;

    return subscribeConversations(userId, (conversations) => {
      setCount(
        conversations.reduce(
          (total, conversation) => total + conversationUnread(conversation, userId),
          0,
        ),
      );
    });
  }, [userId]);

  return userId ? count : 0;
}
