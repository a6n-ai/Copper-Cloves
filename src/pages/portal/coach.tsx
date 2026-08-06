import { requireSessionSSP } from "@/lib/requireSessionSSP";
import { ExerciseCoachThread } from "@/components/chat/ExerciseCoachThread";

export const getServerSideProps = requireSessionSSP();

export default function CoachPage() {
  return (
    <div className="flex min-h-screen flex-col items-center gap-4 bg-muted/30 px-4 py-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-xl font-semibold">Coach</h1>
        <p className="text-sm text-muted-foreground">Your classes, progress, and suggestions.</p>
      </div>
      <ExerciseCoachThread />
    </div>
  );
}
