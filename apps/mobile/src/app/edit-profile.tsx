import { router } from "expo-router";
import { ProfileEditor } from "@/components/ProfileEditor";

export default function EditProfile() {
  return <ProfileEditor onSaved={() => router.back()} />;
}
