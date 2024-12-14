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
    try {
      await sendMessage({ user: NAME, body: newMessageText });
      setNewMessageText("");
      setIsRateLimited(false);
      if (retryInterval) {
        clearInterval(retryInterval);
        setRetryInterval(null);
      }
    } catch (error: any) {
      if (error.message.includes("RateLimited")) {
        const retryAfter = parseFloat(
          error.message.match(/retryAfter":(\d+\.?\d*)/)[1]
        );
        setIsRateLimited(true);
        setRetrySeconds(Math.ceil(retryAfter));

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
          }}
        >
          Rate limit reached. You can send another message in {retrySeconds}{" "}
          seconds.
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
          placeholder="Write a message…"
          disabled={isRateLimited}
          style={isRateLimited ? { opacity: 0.7 } : {}}
        />
        <button
          type="submit"
          disabled={!newMessageText || isRateLimited}
          style={isRateLimited ? { opacity: 0.7 } : {}}
        >
          {isRateLimited ? `Wait ${retrySeconds}s` : "Send"}
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
