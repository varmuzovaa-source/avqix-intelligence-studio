import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getUser: mocks.getUser }, from: mocks.from },
}));
import { uploadWorkspace, downloadWorkspace } from "@/lib/cloud-workspace";
const empty = {
  version: 1 as const,
  savedAt: "2026-11-22T00:00:00Z",
  clients: [],
  goals: {},
  tasks: [],
};
describe("cloud workspace safety", () => {
  beforeEach(() => vi.clearAllMocks());
  it("refuses reads and writes without a verified account", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(uploadWorkspace(empty)).rejects.toThrow("přihlaste");
    await expect(downloadWorkspace()).rejects.toThrow("přihlaste");
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects unassigned legacy tasks before any write", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
    await expect(
      uploadWorkspace({
        ...empty,
        tasks: [
          {
            id: "t",
            sourceKey: "t",
            title: "Task",
            action: "",
            source: "",
            recipient: "",
            impact: "",
            priority: "Nízká",
            owner: "",
            status: "todo",
            createdAt: empty.savedAt,
          },
        ],
      }),
    ).rejects.toThrow("přiřazeného");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
