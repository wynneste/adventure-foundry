import * as Calendar from "expo-calendar";
import { Alert } from "react-native";

/**
 * Opens the phone's own "New Event" screen, pre-filled. The person picks which
 * calendar it goes in — iCloud/Apple Calendar on iPhone, Google Calendar on
 * Android (or any Google account added on iPhone). No Google sign-in needed.
 */
export async function addToCalendar(details: {
  title: string;
  start: Date;
  end?: Date;
  location?: string;
  notes?: string;
}) {
  const { granted } = await Calendar.requestCalendarPermissions(true);
  if (!granted) {
    Alert.alert("Calendar access needed", "Allow calendar access in Settings to add games to your calendar.");
    return;
  }
  const end = details.end ?? new Date(details.start.getTime() + 3 * 60 * 60 * 1000);
  await Calendar.getDefaultCalendarSync().addEventWithForm({
    title: details.title,
    startDate: details.start,
    endDate: end,
    location: details.location,
    notes: details.notes,
  });
}
