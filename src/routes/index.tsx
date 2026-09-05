import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ListChecks, Refrigerator, ReceiptText, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Larder — one shared food system for your household" },
      {
        name: "description",
        content:
          "Everyone adds to one list, a receipt photo fills your kitchen, and meals come from what you already have. Calm household food management.",
      },
      { property: "og:title", content: "Larder — one shared food system for your household" },
      {
        property: "og:description",
        content:
          "Everyone adds to one list, a receipt photo fills your kitchen, and meals come from what you already have.",
      },
    ],
  }),
  component: Landing,
});

const loop = [
  {
    icon: ListChecks,
    title: "One list, everybody",
    body: "Anyone in the house adds what they need, whenever they think of it. No more chasing people for answers before you shop.",
  },
  {
    icon: ReceiptText,
    title: "A photo of the receipt",
    body: "Snap it on the way out of the shop. Your fridge, freezer and pantry fill themselves in — no typing.",
  },
  {
    icon: Refrigerator,
    title: "Know what's at home",
    body: "See what you actually have and what's about to go off, before it quietly turns into waste.",
  },
  {
    icon: CalendarRange,
    title: "Meals that use it up",
    body: "Dinner ideas ranked by what's already in your kitchen, and the few things you still need land back on the list.",
  },
];

function Landing() {
  const { userId, ready } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && userId) navigate({ to: "/today", replace: true });
  }, [ready, userId, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold tracking-tight">Larder</span>
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-20 pt-10 sm:pt-20">
        <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
          Household food, in one place
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.08] sm:text-6xl">
          The list, the kitchen and the week's meals — finally the same thing.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Larder is a shared food system for a household. Everyone contributes to one list, a
          receipt photo keeps track of what's at home, and dinner suggestions come from what you
          already have.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full px-7">
            <Link to="/auth">Start your household</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full px-7">
            <Link to="/auth" search={{ mode: "signin" }}>
              I already have an account
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-2">
        {loop.map((item) => (
          <article key={item.title} className="card-soft p-7">
            <item.icon className="size-6 text-primary" strokeWidth={1.5} aria-hidden />
            <h2 className="mt-5 text-xl">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-muted-foreground">
          Larder — a calmer way to feed a household.
        </div>
      </footer>
    </main>
  );
}
