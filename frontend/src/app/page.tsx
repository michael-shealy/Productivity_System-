export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Daily System
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Morning Briefing + Plan
          </h1>
          <p className="text-sm text-zinc-500">
            Calm, goal-aligned, and ready for check-ins anytime today.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Morning Briefing</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Today is paced. Prioritize identity-aligned wins and protect focus
              blocks.
            </p>
            <div className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              Values focus: presence, grounded confidence, relationship care.
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Focus 3</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              <li className="rounded-lg border border-zinc-200 px-3 py-2">
                Draft graduate program case reflection (learning)
              </li>
              <li className="rounded-lg border border-zinc-200 px-3 py-2">
                2-mile run + mobility (health)
              </li>
              <li className="rounded-lg border border-zinc-200 px-3 py-2">
                Reach out to friend (relationships)
              </li>
            </ul>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Tasks (12)</h2>
              <span className="text-xs text-zinc-500">
                Grouped for low stress
              </span>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Focus Today
                </p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-lg border border-zinc-200 px-3 py-2">
                    Finalize weekly priorities
                  </li>
                  <li className="rounded-lg border border-zinc-200 px-3 py-2">
                    Review internship prep notes
                  </li>
                  <li className="rounded-lg border border-zinc-200 px-3 py-2">
                    Plan weekend social check-in
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Remaining Tasks
                </p>
                <ul className="mt-2 space-y-2 text-sm text-zinc-700">
                  <li className="rounded-lg border border-zinc-200 px-3 py-2">
                    Grocery list + meal plan
                  </li>
                  <li className="rounded-lg border border-zinc-200 px-3 py-2">
                    Read 10 pages (curiosity)
                  </li>
                  <li className="rounded-lg border border-zinc-200 px-3 py-2">
                    Confirm Boston conference logistics
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Calendar</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              <li className="rounded-lg border border-zinc-200 px-3 py-2">
                9:00–10:15 graduate program Class
              </li>
              <li className="rounded-lg border border-zinc-200 px-3 py-2">
                12:30–13:00 Lunch + walk
              </li>
              <li className="rounded-lg border border-zinc-200 px-3 py-2">
                16:00–17:30 Project work
              </li>
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Habit Check‑in</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Quick capture for streaks and amounts. This will connect to the
            imported history and new entries.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              Read 1 page
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              7,000 steps
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              Log calories
            </div>
            <div className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
              No social media
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
