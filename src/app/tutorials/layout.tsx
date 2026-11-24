import { notFound } from "next/navigation";
import { FEATURES } from "@/config/features";

/** Tutorials stay hidden until migration 040 is applied and NEXT_PUBLIC_FEATURE_TUTORIALS=true. */
export default function TutorialsLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.tutorials) notFound();
  return <>{children}</>;
}
