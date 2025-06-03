import { useState } from "react";
import api from "../api"; // pas het pad aan indien nodig!

type Props = {
  suggestion: { id: string, text: string };
  conversationId: string;
  userId: string;
};

export default function SuggestionFeedback({ suggestion, conversationId, userId }: Props) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function sendFeedback(rating: 'good' | 'bad') {
    setFeedback(rating);
    try {
      await api.post("/api/ai-feedback", {
        suggestion_id: suggestion.id,
        suggestion_text: suggestion.text, // Vergeet deze niet!
        conversation_id: conversationId,
        user_id: userId,
        feedback: rating,
      });
    } catch (e) {
      alert("Feedback opslaan mislukt!");
    }
  }

  return (
    <div>
      <div>{suggestion.text}</div>
      <button onClick={() => sendFeedback("good")} disabled={!!feedback}>👍 Goed</button>
      <button onClick={() => sendFeedback("bad")} disabled={!!feedback}>👎 Niet bruikbaar</button>
      {feedback && <span style={{marginLeft: "1rem"}}>Feedback ontvangen!</span>}
    </div>
  );
}
