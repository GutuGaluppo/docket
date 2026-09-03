import { describe, expect, it } from "vitest";

import { BENEFITS, detectBenefits, resolveBenefits } from "./index";

describe("detectBenefits", () => {
  it("reads nothing out of an empty description", () => {
    expect(detectBenefits("")).toEqual([]);
    expect(detectBenefits("   \n  ")).toEqual([]);
  });

  it("finds benefits in the order the ad names them", () => {
    const ad = "We offer 30 Urlaubstage, a learning budget and private health insurance.";
    expect(detectBenefits(ad)).toEqual(["Paid leave", "Learning budget", "Health insurance"]);
  });

  it("returns each benefit once, however often it is mentioned", () => {
    const ad = "Fully remote. Work from home whenever. Did we say remote work?";
    expect(detectBenefits(ad)).toEqual(["Remote work"]);
  });

  it("reads German and Portuguese adverts", () => {
    expect(detectBenefits("Betriebliche Altersvorsorge und Deutschlandticket")).toEqual([
      "Pension",
      "Transport ticket",
    ]);
    expect(detectBenefits("Oferecemos plano de saúde e vale refeição.")).toEqual([
      "Health insurance",
      "Meal allowance",
    ]);
  });

  it("lets the longer alias claim the span", () => {
    // "health insurance" must not also yield a bare-insurance benefit, and
    // "home office budget" is the equipment line, not the remote-work one.
    expect(detectBenefits("private health insurance")).toEqual(["Health insurance"]);
    expect(detectBenefits("a home office budget of 500€")).toEqual(["Equipment budget"]);
  });

  it("does not match inside a longer word", () => {
    expect(detectBenefits("workationing")).toEqual([]);
    expect(detectBenefits("esoperation")).toEqual([]);
  });

  /*
    The traps that shaped the dictionary. Every one of these is a phrase that
    appears in ordinary adverts and describes something other than a benefit;
    each is the reason a tempting single-word alias was left out.
  */
  describe("does not mistake ordinary advert prose for an offer", () => {
    it("ignores a bonus requirement", () => {
      expect(detectBenefits("Bonus: experience with Kubernetes.")).toEqual([]);
    });

    it("ignores a diversity statement", () => {
      const dei = "We are committed to diversity, equity and inclusion in everything we do.";
      expect(detectBenefits(dei)).toEqual([]);
    });

    it("ignores model training", () => {
      expect(detectBenefits("You will own model training and evaluation pipelines.")).toEqual([]);
    });

    it("ignores a flexible attitude and leaving a team", () => {
      expect(detectBenefits("You are flexible and pragmatic.")).toEqual([]);
      expect(detectBenefits("Nobody leaves this team.")).toEqual([]);
    });

    it("ignores visa requirements phrased as a condition", () => {
      expect(detectBenefits("You must already hold a valid visa.")).toEqual([]);
    });
  });

  it("keeps every dictionary alias lowercase", () => {
    for (const [benefit, aliases] of Object.entries(BENEFITS)) {
      for (const alias of aliases) {
        expect(alias, `${benefit} → "${alias}"`).toBe(alias.toLowerCase());
      }
    }
  });
});

describe("resolveBenefits", () => {
  it("keeps what the ad offered when nothing was edited", () => {
    expect(
      resolveBenefits({ detected: ["Remote work", "Pension"], dismissed: [], manual: [] }),
    ).toEqual(["Remote work", "Pension"]);
  });

  it("drops a benefit the person removed, even after a re-paste", () => {
    expect(
      resolveBenefits({
        detected: ["Remote work", "Pension"],
        dismissed: ["Pension"],
        manual: [],
      }),
    ).toEqual(["Remote work"]);
  });

  it("appends what the person typed, without duplicating the ad's own", () => {
    expect(
      resolveBenefits({
        detected: ["Remote work"],
        dismissed: [],
        manual: ["remote work", "Dog friendly office"],
      }),
    ).toEqual(["Remote work", "Dog friendly office"]);
  });
});
