import { test, expect } from "@playwright/test";

test.describe("baseline snapshots", () => {
  test("general channel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Good morning everyone!")).toBeVisible();

    // Channel sidebar: channels + DMs for Michael
    await expect(page.locator("aside").nth(1)).toMatchAriaSnapshot(`
      - complementary:
        - button "Dunder Mifflin":
          - text: ""
          - img
        - img
        - text: Channels
        - button "announcements":
          - img
          - text: ""
        - button "general":
          - img
          - text: ""
        - button "management 2":
          - img
          - text: ""
        - button "party-planning 5":
          - img
          - text: ""
        - button "random 2":
          - img
          - text: ""
        - button "sales 3":
          - img
          - text: ""
        - img
        - text: Direct Messages
        - button "DS Dwight Schrute"
        - button "JH Jim Halpert"
        - button "RH Ryan Howard"
        - button "TF Toby Flenderson 1"
        - text: MS Michael Scott Regional Manager
    `);

    // Message area: #general messages
    await expect(page.locator("aside ~ div").first()).toMatchAriaSnapshot(`
      - img
      - text: general — Company-wide announcements and work-based matters
      - button /\\d+/:
        - img
        - text: ""
      - button:
        - img
      - button:
        - img
      - text: /\\w+, \\w+ \\d+ MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: Good morning everyone! It is a beautiful day at Dunder Mifflin, and I just want to say... I love this company.
      - text: /❤️ 2 SH Stanley Hudson \\d+:\\d+ [AP]M/
      - paragraph: It's Monday, Michael.
      - text: /MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: And what better day to celebrate the gift of employment! Everyone, conference room in 5 minutes. I have a big announcement.
      - text: 😬 3
      - button "3 replies":
        - img
        - text: ""
      - text: /DS Dwight Schrute \\d+:\\d+ [AP]M/
      - paragraph: I'll prepare the conference room. Everyone should be seated by rank.
      - text: /JH Jim Halpert \\d+:\\d+ [AP]M/
      - paragraph: What rank system are we using today, Dwight?
      - text: /😂 3 DS Dwight Schrute \\d+:\\d+ [AP]M/
      - paragraph: Schrute family hierarchy. Obviously. It's based on beet yield per acre.
      - text: /🥬 1 PB Pam Beesly \\d+:\\d+ [AP]M/
      - paragraph: "Reminder: the kitchen fridge will be cleaned out on Friday. Please label your food. Kevin, this means you."
      - text: 👍 2
      - button "2 replies":
        - img
        - text: ""
      - text: /KM Kevin Malone \\d+:\\d+ [AP]M/
      - paragraph: But my chili needs time to marinate! It's a Malone family recipe.
      - text: /🍲 1 CB Creed Bratton \\d+:\\d+ [AP]M/
      - paragraph: I've been storing something in that fridge for three years. Nobody touch it.
      - text: /😨 3 AM Angela Martin \\d+:\\d+ [AP]M/
      - paragraph: /This is exactly why we need stricter kitchen policies\\. I have drafted a \\d+-page proposal\\./
      - text: /OM Oscar Martinez \\d+:\\d+ [AP]M/
      - paragraph: /Angela, a \\d+-page kitchen policy seems a bit excessive\\./
      - text: /💯 2 Yesterday TF Toby Flenderson \\d+:\\d+ [AP]M/
      - paragraph: Hey everyone, just a reminder that the annual safety training is coming up next week. Please sign up on the sheet by my desk.
      - text: /MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: Nobody cares, Toby. Why are you the way that you are?
      - text: /😂 3 KK Kelly Kapoor \\d+:\\d+ [AP]M/
      - paragraph: OMG has anyone seen the new episode of The Bachelor last night?? I literally cannot even right now. 💀
      - text: /💀 1 DP Darryl Philbin \\d+:\\d+ [AP]M/
      - paragraph: Heads up — forklift maintenance is happening this afternoon. Warehouse will be loud. Try not to send Michael down here.
      - text: /😂 2 🏗️ 1 MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: I drove the forklift ONE time, Darryl. And I'd argue I was the best forklift driver this office has ever seen.
      - text: /🤦 3 Today AB Andy Bernard \\d+:\\d+ [AP]M/
      - paragraph: Hey everyone! I just want to say I am PUMPED to be here today. Nard Dog is ready to sell some paper! 🐕
      - text: /🐕 1 MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: That's what she said! ...wait, that doesn't work there. Or does it? 🤔
      - text: 😂 3 🤦 3
      - paragraph: "Message #general (read-only)"
      - button "bold" [disabled]
      - button "italic" [disabled]
      - button "code" [disabled]:
        - img
      - button "link" [disabled]:
        - img
      - button "emoji" [disabled]:
        - img
      - button "attach" [disabled]:
        - img
      - button "send" [disabled]:
        - img
    `);
  });

  test("accounting channel (private)", async ({ page }) => {
    await page.goto("/");

    // Switch to Kevin (member of #accounting)
    await page.getByTitle("Kevin Malone").click();

    // Navigate to #accounting
    await page.getByRole("button", { name: "accounting" }).click();
    await expect(
      page.getByText("Q3 expense reports are due by end of day Friday")
    ).toBeVisible();

    // Channel sidebar: Kevin sees accounting channel, no DMs section
    await expect(page.locator("aside").nth(1)).toMatchAriaSnapshot(`
      - complementary:
        - button "Dunder Mifflin":
          - text: ""
          - img
        - img
        - text: Channels
        - button "accounting":
          - img
          - text: ""
        - button "announcements":
          - img
          - text: ""
        - button "general 1":
          - img
          - text: ""
        - button "party-planning 3":
          - img
          - text: ""
        - button "random":
          - img
          - text: ""
        - button "sales":
          - img
          - text: ""
        - img
        - text: Direct Messages KM Kevin Malone Accountant
    `);

    // Message area: #accounting messages
    await expect(page.locator("aside ~ div").first()).toMatchAriaSnapshot(`
      - img
      - text: accounting — Accounting department — budgets, expenses, and reconciliation
      - button "3":
        - img
        - text: ""
      - button:
        - img
      - button:
        - img
      - text: /\\w+, \\w+ \\d+ AM Angela Martin \\d+:\\d+ [AP]M/
      - paragraph: Q3 expense reports are due by end of day Friday. No exceptions. Kevin, that includes you.
      - text: /KM Kevin Malone \\d+:\\d+ [AP]M/
      - paragraph: I'm working on it. Math is hard when the numbers are big.
      - text: /🤦 1 OM Oscar Martinez \\d+:\\d+ [AP]M/
      - paragraph: Kevin, you literally just have to add up the receipts. I made you a spreadsheet template.
      - text: /KM Kevin Malone \\d+:\\d+ [AP]M/
      - paragraph: The spreadsheet has too many columns. Can we just do one big column?
      - text: /😂 1 Yesterday AM Angela Martin \\d+:\\d+ [AP]M/
      - paragraph: /I found a \\$\\d+ discrepancy in the petty cash\\. Someone explain\\. NOW\\./
      - button "2 replies":
        - img
        - text: ""
      - text: /KM Kevin Malone \\d+:\\d+ [AP]M/
      - paragraph: It wasn't me. Although I did buy a lot of vending machine snacks last week.
      - text: /OM Oscar Martinez \\d+:\\d+ [AP]M/
      - paragraph: I ran the numbers again. The discrepancy is from Michael's 'business lunch' at Benihana. He charged it to office supplies.
      - text: /😑 1 AM Angela Martin \\d+:\\d+ [AP]M/
      - paragraph: I am filing a formal complaint. This is the third time this quarter.
      - paragraph: "Message #accounting (read-only)"
      - button "bold" [disabled]
      - button "italic" [disabled]
      - button "code" [disabled]:
        - img
      - button "link" [disabled]:
        - img
      - button "emoji" [disabled]:
        - img
      - button "attach" [disabled]:
        - img
      - button "send" [disabled]:
        - img
    `);
  });

  test("DM conversation", async ({ page }) => {
    await page.goto("/");

    // Click on Jim Halpert DM (Michael is default user)
    await page
      .getByRole("button", { name: "Jim Halpert" })
      .filter({ hasNotText: /reply|replies/ })
      .first()
      .click();
    await expect(page.getByText("My main man")).toBeVisible();

    // Message area: Michael ↔ Jim DM
    await expect(page.locator("aside ~ div").first()).toMatchAriaSnapshot(`
      - text: JH Jim Halpert
      - button:
        - img
      - text: /Yesterday MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: Jim! My main man. My number two. My right hand. Want to get lunch?
      - text: /JH Jim Halpert \\d+:\\d+ [AP]M/
      - paragraph: Sure Michael, where were you thinking?
      - text: /MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: Chili's! The new Awesome Blossom is calling my name. 🌺
      - text: /😂 1 JH Jim Halpert \\d+:\\d+ [AP]M/
      - paragraph: Michael, Chili's banned you.
      - text: /MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: That was a MISUNDERSTANDING. I was just showing everyone the Dundies.
      - text: /JH Jim Halpert \\d+:\\d+ [AP]M/
      - paragraph: How about Cooper's? They have good sandwiches.
      - text: /MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: Deal! You're paying though. Boss privileges. 😎
      - paragraph: Message Jim Halpert (read-only)
      - button "bold" [disabled]
      - button "italic" [disabled]
      - button "code" [disabled]:
        - img
      - button "link" [disabled]:
        - img
      - button "emoji" [disabled]:
        - img
      - button "attach" [disabled]:
        - img
      - button "send" [disabled]:
        - img
    `);
  });

  test("thread panel", async ({ page }) => {
    await page.goto("/");

    // Open thread on Michael's "big announcement" message (gen-3, has 3 replies)
    await page.getByText("3 replies").first().click();
    await expect(
      page.getByText("Please tell me it's not another movie Monday")
    ).toBeVisible();

    // Thread panel: parent message + 3 replies
    await expect(page.locator("[class*='thread'], aside ~ div ~ div").last()).toMatchAriaSnapshot(`
      - text: Thread
      - button "Close thread":
        - img
      - text: /MS Michael Scott \\d+:\\d+ [AP]M/
      - paragraph: And what better day to celebrate the gift of employment! Everyone, conference room in 5 minutes. I have a big announcement.
      - text: /😬 3 3 replies JH Jim Halpert \\d+:\\d+ [AP]M/
      - paragraph: Please tell me it's not another movie Monday.
      - text: /😂 1 DS Dwight Schrute \\d+:\\d+ [AP]M/
      - paragraph: I hope it's a promotion announcement. I've been preparing my "Assistant Regional Manager" acceptance speech.
      - text: /PB Pam Beesly \\d+:\\d+ [AP]M/
      - paragraph: Last time he had a 'big announcement' it was that he learned how to make espresso.
      - text: ☕ 2
      - paragraph: Reply... (read-only)
      - img
      - img
    `);
  });

  test("user switcher", async ({ page }) => {
    await page.goto("/");

    // Switch to Jim — sidebar should update to Jim's channels/DMs
    await page.getByTitle("Jim Halpert").click();
    await expect(page.getByText("Sales Representative").last()).toBeVisible();

    // Channel sidebar: Jim's view (different DMs, different unread counts)
    await expect(page.locator("aside").nth(1)).toMatchAriaSnapshot(`
      - complementary:
        - button "Dunder Mifflin":
          - text: ""
          - img
        - img
        - text: Channels
        - button "announcements 2":
          - img
          - text: ""
        - button "general":
          - img
          - text: ""
        - button "management 1":
          - img
          - text: ""
        - button "party-planning":
          - img
          - text: ""
        - button "random":
          - img
          - text: ""
        - button "sales":
          - img
          - text: ""
        - img
        - text: Direct Messages
        - button "AB Andy Bernard 1"
        - button "DS Dwight Schrute 2"
        - button "PB Pam Beesly"
        - button "MS Michael Scott"
        - text: JH Jim Halpert Sales Representative
    `);
  });
});
