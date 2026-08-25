"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour.css";

type PageTour = { key: string; steps: DriveStep[] };

const STORAGE_PREFIX = "votamak_tour_";

// ── Per-page tour definitions ───────────────────────────────────────────────

const dashboardTour: PageTour = {
  key: "dashboard",
  steps: [
    {
      popover: {
        title: "Welcome — Admin Dashboard",
        description:
          "This is your command centre. You can see the state of all elections, registered voters, and ballots at a glance.",
      },
    },
    {
      element: "#tour-stat-cards",
      popover: {
        title: "Key Metrics",
        description:
          "These four cards show your total elections, any currently active poll, how many voters are registered, and ballots cast across recent elections.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-recent-elections",
      popover: {
        title: "Recent Elections",
        description:
          "Your most recent elections are listed here. Click any row to open that election and manage its positions, candidates, and lifecycle.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "#tour-quick-actions",
      popover: {
        title: "Quick Actions",
        description:
          "Jump straight to the most common tasks — create an election, register voters, or review results — all from these shortcuts.",
        side: "left",
        align: "start",
      },
    },
    {
      element: "#tour-admin-elections",
      popover: {
        title: "Navigation Sidebar",
        description:
          "Use the sidebar to move between Elections, Voters, Results, Admins, and the Audit log. The ⓘ button in the top bar replays this tour at any time.",
        side: "right",
        align: "start",
      },
    },
  ],
};

const electionsTour: PageTour = {
  key: "elections",
  steps: [
    {
      popover: {
        title: "Elections",
        description:
          "All your elections are displayed here as cards, each showing its current status — Draft, Open, or Closed — along with the number of positions and ballots.",
      },
    },
    {
      element: "#tour-elections-new-btn",
      popover: {
        title: "Create an Election",
        description:
          "Click 'New election' to start a fresh ballot. Give it a name and an optional description. Positions and candidates are added on the next screen.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#tour-elections-list",
      popover: {
        title: "Election Cards",
        description:
          "Click any card to open that election's detail page, where you manage positions, add candidates, and control the full election lifecycle.",
        side: "top",
        align: "start",
      },
    },
  ],
};

const electionDetailTour: PageTour = {
  key: "election_detail",
  steps: [
    {
      popover: {
        title: "Election Control Panel",
        description:
          "This is the full management screen for a single election — from initial setup all the way through to live and final results.",
      },
    },
    {
      element: "#tour-election-header",
      popover: {
        title: "Election Header",
        description:
          "The election name, its current status badge (Draft / Open / Closed), and the primary action buttons live here. 'Open for voting' becomes active once every position has at least one candidate.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-add-position-section",
      popover: {
        title: "Add Positions",
        description:
          "Type a position title — e.g. Chairman, Secretary, Treasurer — then click Add. Each position you create will hold its own set of candidates on the ballot.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-positions-section",
      popover: {
        title: "Positions & Candidates",
        description:
          "Each position card lists its candidates. Use the 'Add candidate' form inside each card to add contestants. You can also link a candidate to a registered voter so their name auto-fills from your voter list.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "#tour-election-results",
      popover: {
        title: "Live & Final Results",
        description:
          "Once the election is opened, real-time tallies appear here and update as votes come in. After closing, this section shows the final certified result.",
        side: "top",
        align: "start",
      },
    },
  ],
};

const votersTour: PageTour = {
  key: "voters",
  steps: [
    {
      popover: {
        title: "Voter Management",
        description:
          "Only members registered on this page can access the ballot. Each voter is issued a unique Voter ID and a password that you control.",
      },
    },
    {
      element: "#tour-voters-register-btn",
      popover: {
        title: "Register a Voter",
        description:
          "Click to add a new voter. Enter their full name and email, then assign a Voter ID and password. The system can auto-generate both for you with one click.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#voter-filter",
      popover: {
        title: "Search Voters",
        description:
          "Type a name, email address, or Voter ID to instantly filter the table and find any registered member.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-voters-table",
      popover: {
        title: "Voter Table",
        description:
          "Every registered voter appears here with their registration date and ballot count. Use 'Reset password' to generate a new one-time password, or 'Remove' to deregister a voter who has not yet cast a ballot.",
        side: "top",
        align: "start",
      },
    },
  ],
};

const resultsTour: PageTour = {
  key: "results",
  steps: [
    {
      popover: {
        title: "Results Dashboard",
        description:
          "Live and final tallies for every election that has been opened for voting. Results are grouped by election and broken down per position.",
      },
    },
    {
      element: "#tour-results-header",
      popover: {
        title: "Refresh",
        description:
          "Click Refresh to manually pull the latest vote counts from the server. While the election is open, refreshing frequently keeps you up to date.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#tour-results-elections",
      popover: {
        title: "Position Tallies",
        description:
          "Each position is shown with a bar chart comparing candidate vote counts and percentages. The current leader is highlighted in green. Once the election is closed, these become the final official results.",
        side: "top",
        align: "start",
      },
    },
  ],
};

const adminsTour: PageTour = {
  key: "admins",
  steps: [
    {
      popover: {
        title: "Admin Accounts",
        description:
          "Only accounts listed here can sign in to the administration panel. There must always be at least one active admin — the system prevents you from removing the last one.",
      },
    },
    {
      element: "#tour-admins-add-btn",
      popover: {
        title: "Add an Admin",
        description:
          "Click to create a new administrator account. Set their full name, email address, and a passcode. They can update their passcode after their first sign-in via the Change Passcode link.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: "#tour-admins-table",
      popover: {
        title: "Admin List",
        description:
          "All current administrators are listed here with the date their account was created. A 'You' badge marks your own account. You cannot remove yourself or the last remaining admin.",
        side: "top",
        align: "start",
      },
    },
  ],
};

const auditTour: PageTour = {
  key: "audit",
  steps: [
    {
      popover: {
        title: "Audit Log",
        description:
          "Every state-changing action is recorded here — admin sign-ins, voter registrations, ballot submissions, election opens and closes, and more. Each entry includes IP address, location, device, and browser.",
      },
    },
    {
      element: "#tour-audit-filters",
      popover: {
        title: "Filter & Search",
        description:
          "Search by actor name, IP address, city, or country. Use the Actor dropdown to filter down to admins only or voters only, making it easier to investigate a specific event.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "#tour-audit-table",
      popover: {
        title: "Event Log",
        description:
          "Each row shows when an event occurred, who triggered it, the action type, their location, device, and IP. Colour-coded badges make it easy to spot failed logins, deletions, and ballot events at a glance.",
        side: "top",
        align: "start",
      },
    },
  ],
};

// ── Route → tour mapping ────────────────────────────────────────────────────

function getPageTour(pathname: string): PageTour | null {
  if (pathname === "/admin") return dashboardTour;
  if (pathname === "/admin/elections") return electionsTour;
  if (pathname.startsWith("/admin/elections/")) return electionDetailTour;
  if (pathname === "/admin/voters") return votersTour;
  if (pathname === "/admin/results") return resultsTour;
  if (pathname === "/admin/admins") return adminsTour;
  if (pathname === "/admin/audit") return auditTour;
  return null;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function SystemTour() {
  const pathname = usePathname();

  const startTour = useCallback(
    (pageTour: PageTour) => {
      const driverObj = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayOpacity: 0.82,
        stagePadding: 8,
        stageRadius: 10,
        doneBtnText: "Done ✓",
        nextBtnText: "Next →",
        prevBtnText: "← Back",
        popoverClass: "votamak-tour-popover",
        steps: pageTour.steps,
        onDestroyed: () => {
          if (!window.location.search.includes("tour=1")) {
            localStorage.setItem(STORAGE_PREFIX + pageTour.key, "true");
          }
        },
      });
      driverObj.drive();
    },
    [],
  );

  useEffect(() => {
    const pageTour = getPageTour(pathname);
    if (!pageTour) return;

    const handleManualStart = () => startTour(pageTour);
    window.addEventListener("start-admin-tour", handleManualStart);

    const forceTour = window.location.search.includes("tour=1");
    const hasCompleted = localStorage.getItem(STORAGE_PREFIX + pageTour.key);

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (forceTour || !hasCompleted) {
      timer = setTimeout(
        () => startTour(pageTour),
        forceTour ? 1800 : 1000,
      );
    }

    return () => {
      window.removeEventListener("start-admin-tour", handleManualStart);
      if (timer) clearTimeout(timer);
    };
  }, [pathname, startTour]);

  return null;
}
