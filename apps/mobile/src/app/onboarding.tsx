import { ProfileEditor } from "@/components/ProfileEditor";

// The root layout swaps to the tabs automatically once the profile is onboarded.
export default function Onboarding() {
  return <ProfileEditor onSaved={() => {}} />;
}
