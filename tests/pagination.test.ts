import { describe, expect, it } from "vitest";
import { clampPage, pageCount, pageHref, pageItems, pageRange, parsePage, showingText, slicePage } from "@/lib/pagination";

describe("pagination math", () => {
  it("parses page and size with safe fallbacks", () => {
    expect(parsePage({})).toEqual({ page: 1, pageSize: 12, skip: 0, take: 12 });
    expect(parsePage({ page: "3" }, 10)).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 });
    expect(parsePage({ page: "0" }).page).toBe(1);
    expect(parsePage({ page: "-4" }).page).toBe(1);
    expect(parsePage({ page: "abc" }).page).toBe(1);
    expect(parsePage({ page: ["2", "5"] }).page).toBe(2);
    expect(parsePage({ size: "500" }).pageSize).toBe(100);
    expect(parsePage({ size: "5" }).take).toBe(5);
    expect(parsePage({ p: "2" }, 12, "p").skip).toBe(12);
  });

  it("counts pages and clamps out-of-range pages", () => {
    expect(pageCount(0, 12)).toBe(1);
    expect(pageCount(12, 12)).toBe(1);
    expect(pageCount(13, 12)).toBe(2);
    expect(clampPage(parsePage({ page: "99" }, 10), 57)).toMatchObject({ page: 6, skip: 50 });
    expect(clampPage(parsePage({ page: "2" }, 10), 57)).toMatchObject({ page: 2, skip: 10 });
    expect(clampPage(parsePage({ page: "5" }, 10), 0)).toMatchObject({ page: 1, skip: 0 });
  });

  it("describes the range in plain words", () => {
    expect(pageRange(57, 1, 12)).toEqual({ from: 1, to: 12 });
    expect(pageRange(57, 5, 12)).toEqual({ from: 49, to: 57 });
    expect(showingText(57, 1, 12)).toBe("Showing 1–12 of 57 results");
    expect(showingText(1, 1, 12, "tests")).toBe("Showing 1–1 of 1 tests");
    expect(showingText(0, 1, 12, "centers")).toBe("No centers");
    expect(showingText(150000, 1, 12)).toBe("Showing 1–12 of 1,50,000 results");
  });

  it("lists page numbers with ellipses and a steady width", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    expect(pageItems(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
    expect(pageItems(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
    expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
    for (let page = 1; page <= 20; page += 1) expect(pageItems(page, 20)).toHaveLength(7);
  });

  it("builds hrefs that keep other params", () => {
    expect(pageHref("/tests", { q: "thyroid", view: "list", page: "2" }, 3)).toBe("/tests?q=thyroid&view=list&page=3");
    expect(pageHref("/tests", { q: "thyroid", page: "2" }, 1)).toBe("/tests?q=thyroid");
    expect(pageHref("/centers/compare", { pick: ["a", "b"] }, 2)).toBe("/centers/compare?pick=a&pick=b&page=2");
    expect(pageHref("/x", {}, 2, "tp", "#tickets")).toBe("/x?tp=2#tickets");
  });

  it("slices in-memory lists", () => {
    const rows = Array.from({ length: 25 }, (_, index) => index);
    expect(slicePage(rows, parsePage({ page: "3" }, 10))).toMatchObject({ items: [20, 21, 22, 23, 24], total: 25 });
    expect(slicePage(rows, parsePage({ page: "9" }, 10)).args.page).toBe(3);
  });
});
