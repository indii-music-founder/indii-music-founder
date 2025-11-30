import Hero from "./components/Hero";
import DeepListening from "./components/DeepListening";
import AgentZero from "./components/AgentZero";
import Business from "./components/Business";
import Commerce from "./components/Commerce";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <Hero />
      <DeepListening />
      <AgentZero />
      <Business />
      <Commerce />
    </main>
  );
}
