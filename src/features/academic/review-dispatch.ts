import { LEVEL_CODES } from "@/features/academic/validation";

/** How one migration review item (E4 legacy backfill) is resolved. Pure, so it is unit-tested. */
export type ResolutionPlan = {
  kind: "insert_audience" | "create_offering" | "set_lecture_offering" | "confirm_placement" | "dismiss";
  payload: Record<string, string>;
};

export const REVIEW_ITEM_LABELS: Record<string, string> = {
  announcement_level: "Legacy level announcements (hidden until a level is chosen)",
  quest_audience: "Quests without an audience (hidden)",
  lecture_out_of_range: "Lectures outside any offered semester",
  placement: "Levels carried over from old profiles (confirm)",
  offering_semester: "Courses to offer this semester",
  profile_no_matric: "Accounts without a matriculation number",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isLevel = (v: string | undefined): v is string => !!v && (LEVEL_CODES as readonly string[]).includes(v);

export function planResolution(
  item: { item_type: string; entity_id: string },
  values: Record<string, string | undefined>
): ResolutionPlan {
  if (values.decision === "dismiss") return { kind: "dismiss", payload: {} };

  switch (item.item_type) {
    case "announcement_level":
      if (!isLevel(values.level_code)) throw new Error("Choose a level.");
      return { kind: "insert_audience", payload: { announcement_id: item.entity_id, audience_kind: "level", level_code: values.level_code } };
    case "quest_audience":
      if (values.audience === "department") return { kind: "insert_audience", payload: { quest_id: item.entity_id, audience_kind: "department" } };
      if (!isLevel(values.audience)) throw new Error("Choose who should see the quest.");
      return { kind: "insert_audience", payload: { quest_id: item.entity_id, audience_kind: "level", level_code: values.audience } };
    case "lecture_out_of_range":
      if (!values.offering_id || !UUID.test(values.offering_id)) throw new Error("Choose a class.");
      return { kind: "set_lecture_offering", payload: { lecture_id: item.entity_id, offering_id: values.offering_id } };
    case "placement":
      return { kind: "confirm_placement", payload: { placement_id: item.entity_id } };
    case "offering_semester":
      if (!values.course_id || !values.semester_id || !isLevel(values.level_code)) throw new Error("Choose the course, semester and level.");
      return { kind: "create_offering", payload: { course_id: values.course_id, semester_id: values.semester_id, level_code: values.level_code } };
    case "profile_no_matric":
      return { kind: "dismiss", payload: {} };
    default:
      throw new Error(`Unknown review item type: ${item.item_type}`);
  }
}
