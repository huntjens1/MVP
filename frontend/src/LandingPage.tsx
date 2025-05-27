import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <main className="flex flex-col min-h-screen bg-calllogix-dark text-calllogix-text items-center justify-center">
      <div className="max-w-xl w-full p-8 bg-calllogix-card rounded-2xl shadow-2xl flex flex-col gap-8 mt-24">
        <h1 className="text-4xl font-black text-calllogix-primary text-center">
          Welkom bij <span className="text-calllogix-accent">CallLogix</span>
        </h1>
        <p className="text-lg text-center">
          De slimme AI-transcriptie & servicedesk-tool voor IT-supportteams.<br />
          Live transcriptie, automatische vraagsuggesties en veilige opslag.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            to="/auth"
            className="w-full text-center bg-calllogix-primary text-calllogix-text font-bold px-6 py-3 rounded-xl hover:bg-calllogix-accent hover:text-calllogix-dark transition"
          >
            Inloggen
          </Link>
          <Link
            to="/auth"
            className="w-full text-center bg-calllogix-accent text-calllogix-dark font-bold px-6 py-3 rounded-xl hover:bg-calllogix-primary hover:text-calllogix-text transition"
          >
            Account aanmaken
          </Link>
        </div>
        <div className="text-xs text-center text-calllogix-subtext mt-6">
          © {new Date().getFullYear()} CallLogix. Alle rechten voorbehouden.
        </div>
      </div>
    </main>
  );
}
