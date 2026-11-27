import { createEventInCalendarAsync } from "expo-calendar/legacy";
import { Platform } from "react-native";
import type { Meeting } from "@shared/forum";
import { Button } from "./ui";

/** Opens the iOS "new event" sheet prefilled with the forum. Nothing is written without the member's tap. */
export function AddToCalendar({ meeting }: { meeting: Meeting }) {
  if (Platform.OS !== "ios" || !meeting.starts_at) return null;
  const start = new Date(meeting.starts_at);
  return (
    <Button
      ghost
      label="Add to calendar"
      onPress={() =>
        createEventInCalendarAsync({
          title: "Shadow Forum",
          startDate: start,
          endDate: new Date(start.getTime() + 3 * 3_600_000),
          location: meeting.place ?? undefined,
        }).catch(() => {})
      }
    />
  );
}
