import { useEffect, useState } from "react";
import { faker } from "@faker-js/faker";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const NAME = getOrSetFakeName();

export default function App() {
  const messages = useQuery(api.chat.getMessages);
  const sendMessage = useMutation(api.chat.sendMessage);
  const [newMessageText, setNewMessageText] = useState("");
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [retryInterval, setRetryInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }, 0);
  }, [messages]);

  useEffect(() => {
    return () => {
      if (retryInterval) {
        clearInterval(retryInterval);
      }
    };
  }, [retryInterval]);

  const handleSendMessage = async (e: { preventDefault: () => void }) => {
    e.preventDefault();

    // If we're rate limited, don't try to send
    if (isRateLimited) {
      return;
    }

    try {
      await sendMessage({ user: NAME, body: newMessageText });
      setNewMessageText("");
      setIsRateLimited(false);
      if (retryInterval) {
        clearInterval(retryInterval);
        setRetryInterval(null);
      }
    } catch (error: any) {
      // Parse the error message to get the JSON object
      try {
        const errorMatch = error.message.match(/\{.*\}/);
        if (errorMatch) {
          const errorObj = JSON.parse(errorMatch[0]);
          if (errorObj.kind === "RateLimited") {
            setIsRateLimited(true);
            const retryAfter = Math.ceil(errorObj.retryAfter);
            setRetrySeconds(retryAfter);

            const interval = setInterval(() => {
              setRetrySeconds((prev) => {
                if (prev <= 1) {
                  clearInterval(interval);
                  setIsRateLimited(false);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);

            setRetryInterval(interval);
          }
        }
      } catch (parseError) {
        console.error("Failed to parse rate limit error", error);
      }
    }
  };

  const formatRetryTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} seconds`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <main className="chat">
      <header>
        <h1>Convex Chat</h1>
        <p>
          Connected as <strong>{NAME}</strong>
        </p>
      </header>

      {isRateLimited && (
        <article
          style={{
            backgroundColor: "var(--primary)",
            color: "white",
            padding: "12px",
            margin: "12px auto",
            borderRadius: "8px",
            maxWidth: "380px",
            textAlign: "center",
          }}
        >
          Rate limit reached. You can send another message in{" "}
          {formatRetryTime(retrySeconds)}.
        </article>
      )}

      {messages?.map((message) => (
        <article
          key={message._id}
          className={message.user === NAME ? "message-mine" : ""}
        >
          <div>{message.user}</div>
          <p>{message.body}</p>
        </article>
      ))}

      <form onSubmit={handleSendMessage}>
        <input
          value={newMessageText}
          onChange={(e) => setNewMessageText(e.target.value)}
          placeholder={
            isRateLimited
              ? `Rate limited for ${formatRetryTime(retrySeconds)}...`
              : "Write a message…"
          }
          disabled={isRateLimited}
          style={isRateLimited ? { opacity: 0.7 } : {}}
        />
        <button
          type="submit"
          disabled={!newMessageText || isRateLimited}
          style={isRateLimited ? { opacity: 0.7 } : {}}
        >
          {isRateLimited ? `${formatRetryTime(retrySeconds)}` : "Send"}
        </button>
      </form>
    </main>
  );
}

function getOrSetFakeName() {
  const NAME_KEY = "tutorial_name";
  const name = sessionStorage.getItem(NAME_KEY);
  if (!name) {
    const newName = faker.person.firstName();
    sessionStorage.setItem(NAME_KEY, newName);
    return newName;
  }
  return name;
}
