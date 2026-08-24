import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// Set a long timeout for the entire audit crawl
test.setTimeout(450000); // 7.5 minutes

interface PageAuditResult {
  url: string;
  title: string;
  statusCode: number;
  consoleErrors: string[];
  consoleWarnings: string[];
  failedRequests: string[];
  brokenImages: string[];
  a11yIssues: string[];
  uiBugs: string[];
  uxIssues: string[];
  recommendations: string[];
  reproductionSteps: string;
  screenshotPath?: string;
}

test.describe("comprehensive-site-audit", () => {
  test("run end-to-end crawl and generate audit report", async ({ page }) => {
    const results: PageAuditResult[] = [];
    const visited = new Set<string>();
    
    // We start with a base list of known routes to ensure we visit them even if links aren't fully reachable.
    const queue = [
      "/dashboard",
      "/profile",
      "/academic/timetable",
      "/academic/attendance-details",
      "/academic/curriculum",
      "/academic/sap-scholarships",
      "/exams/current-semester-results",
      "/exams/earlier-semester-results",
      "/finance/fee-dues",
      "/finance/fee-paid",
      "/finance/bank-details",
      "/registration/course-registration",
      "/registration/minor-oe-registration",
      "/registration/exam-registration",
      "/registration/hostel-registration",
      "/registration/transport-registration",
      "/registration/sap-registration",
      "/transport-hostel/room-details",
      "/transport-hostel/route-details",
      "/transport-hostel/refund-change-requests",
      "/feedback/course-feedback",
      "/feedback/events-feedback",
      "/feedback/hostel-mess-feedback",
      "/feedback/transport-feedback",
      "/academic-tracker/progress-overview",
      "/academic-tracker/academic-insights",
      "/academic-tracker/unified-insights",
      "/helpdesk/raise-ticket",
      "/helpdesk/faqs",
      "/helpdesk/track-escalate",
      "/events",
      "/events/create",
      "/events/my-activity",
      "/events/my-teams",
      "/events/my-created",
      "/events/attendance",
      "/learn",
      "/learn/discover",
      "/learn/practice",
      "/learn/me",
      "/learn/contribute",
      "/learn/contribute/new",
      "/learn/requests",
      "/learn/guides",
      "/learn/guides/new",
      "/learn/roadmaps",
      "/learn/roadmaps/new",
      "/learn/materials",
      "/career",
      "/career/jobs",
      "/career/internships",
      "/career/hackathons",
      "/career/competitions",
      "/career/me/bookmarks",
      "/career/me/tracker",
      "/career/me/interviews",
      "/career/me/profile",
      "/career/me/skill-gap",
      "/career/alumni",
      "/career/submit",
      "/notifications",
      "/settings",
      // Admin routes
      "/admin/events-management",
      "/admin/content-management",
      "/admin/system-controls",
      "/admin/campus-feedback",
      "/admin/lms-moderation",
      "/admin/helpdesk-tickets",
      "/admin/helpdesk-faqs",
      "/admin/career-opportunities",
      "/admin/career-interviews",
      "/admin/career-alumni",
      "/admin/department-performance",
      "/admin/event-approvals",
      "/admin/audit-logs",
      "/admin/certificate-templates"
    ];

    // Ensure screenshot output directory exists
    const screenshotsDir = "/home/zorro-omarchy/.gemini/antigravity-ide/brain/d7b3e431-4ea0-42c5-8d55-2cc688a321c7/audit_screenshots";
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Capture console errors/warnings globally
    const currentConsoleErrors: string[] = [];
    const currentConsoleWarnings: string[] = [];
    const currentFailedRequests: string[] = [];

    page.on("console", (msg) => {
      const text = msg.text();
      if (msg.type() === "error") {
        currentConsoleErrors.push(text);
      } else if (msg.type() === "warning") {
        currentConsoleWarnings.push(text);
      }
    });

    page.on("pageerror", (err) => {
      currentConsoleErrors.push(`Uncaught Exception: ${err.message}\n${err.stack}`);
    });

    page.on("requestfailed", (req) => {
      currentFailedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText || "failed"}`);
    });

    // 1. Initial login verification
    console.log("Going to login page...");
    await page.goto("/login");
    
    // Check if redirect occurs automatically
    try {
      await page.waitForURL("**/dashboard", { timeout: 10000 });
      console.log("Auto-login redirect succeeded!");
    } catch (e) {
      console.log("Auto-login did not redirect within 10s. Trying manual submit since we are in debug mode...");
      // In case auto-login is not running, let's type and submit
      await page.locator("#username").fill("AP23110010419");
      await page.locator("#password").fill("password"); // Dev login doesn't verify password
      // Since it's debug mode, the backend /api/dev/login doesn't require captcha
      // Let's check if the submit button is enabled or if we need to fill captcha.
      // Wait, let's see if we can trigger form submit
      await page.locator("form").evaluate((form) => {
        // Submit dev login directly
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/dev/login", false);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.send(JSON.stringify({ username: "AP23110010419" }));
        const res = JSON.parse(xhr.responseText);
        if (res.success) {
          localStorage.setItem("sessionId", res.sessionId);
          localStorage.setItem("profileData", JSON.stringify(res.profileData));
        }
      });
      await page.goto("/dashboard");
      await page.waitForURL("**/dashboard", { timeout: 5000 });
      console.log("Manual fallback login succeeded!");
    }

    // Elevate admin status by calling the unlock endpoint to make sure admin context works
    await page.evaluate(async () => {
      try {
        await fetch("/api/admin/access/unlock", { method: "POST" });
      } catch (err) {
        console.error("Failed to unlock admin", err);
      }
    });

    // Process crawl queue
    let pagesProcessed = 0;
    while (queue.length > 0 && pagesProcessed < 120) {
      const currentPath = queue.shift()!;
      
      // Clean path and ensure absolute
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);
      pagesProcessed++;

      console.log(`Auditing page [${pagesProcessed}]: ${currentPath}`);
      
      // Clear console logs for this page load
      currentConsoleErrors.length = 0;
      currentConsoleWarnings.length = 0;
      currentFailedRequests.length = 0;

      const pageResult: PageAuditResult = {
        url: currentPath,
        title: "",
        statusCode: 200,
        consoleErrors: [],
        consoleWarnings: [],
        failedRequests: [],
        brokenImages: [],
        a11yIssues: [],
        uiBugs: [],
        uxIssues: [],
        recommendations: [],
        reproductionSteps: `Navigate to: ${currentPath} as an authenticated user.`,
      };

      try {
        // Load the page
        const response = await page.goto(currentPath, { waitUntil: "load", timeout: 15000 });
        pageResult.statusCode = response?.status() || 200;
        
        // Give dynamic elements some time to render
        await page.waitForTimeout(1500);
        pageResult.title = await page.title();

        // 1. Gather all internal links from this page to feed the crawler
        const pageLinks = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a"));
          return links
            .map(a => a.getAttribute("href"))
            .filter((href): href is string => {
              if (!href) return false;
              if (href.startsWith("http://") || href.startsWith("https://")) {
                return href.includes(window.location.host);
              }
              return href.startsWith("/") && !href.startsWith("/logout") && !href.startsWith("/login");
            })
            .map(href => {
              try {
                const url = new URL(href, window.location.origin);
                return url.pathname;
              } catch {
                return href;
              }
            });
        });

        for (const href of pageLinks) {
          if (!visited.has(href) && !queue.includes(href)) {
            // Keep queue limits reasonable to avoid infinite loops, but queue newly discovered paths
            if (queue.length < 100) {
              queue.push(href);
            }
          }
        }

        // 2. Perform static a11y audit checks
        const a11yCheck = await page.evaluate(() => {
          const issues: string[] = [];
          
          // Check for single h1
          const h1s = document.querySelectorAll("h1");
          if (h1s.length === 0) {
            issues.push("Missing <h1> heading.");
          } else if (h1s.length > 1) {
            issues.push(`Multiple <h1> headings found (${h1s.length}).`);
          }

          // Check for images without alt attributes
          const images = document.querySelectorAll("img");
          images.forEach((img, index) => {
            if (!img.getAttribute("alt") && !img.getAttribute("aria-hidden")) {
              issues.push(`Image #${index + 1} (${img.getAttribute("src") || "no source"}) is missing alternative text (alt or aria-hidden).`);
            }
          });

          // Check for form controls without labels
          const inputs = document.querySelectorAll("input, select, textarea");
          inputs.forEach((input, index) => {
            const id = input.getAttribute("id");
            const type = input.getAttribute("type");
            if (type === "hidden" || type === "submit" || type === "button") return;
            
            let hasLabel = false;
            if (id) {
              const label = document.querySelector(`label[for="${id}"]`);
              if (label) hasLabel = true;
            }
            if (!hasLabel && input.closest("label")) {
              hasLabel = true;
            }
            if (!hasLabel && (input.getAttribute("aria-label") || input.getAttribute("aria-labelledby"))) {
              hasLabel = true;
            }
            if (!hasLabel) {
              issues.push(`Form input #${index + 1} (type="${type || "text"}", id="${id || "no-id"}") has no accessible label.`);
            }
          });

          // Check for contrast elements
          // We can do a quick check of elements that might have contrast concerns if we identify specific class names or colors.
          // For now, let's flag inputs with placeholder text that might be too light.

          return issues;
        });
        pageResult.a11yIssues.push(...a11yCheck);

        // 3. Find broken visual assets
        const brokenImages = await page.evaluate(async () => {
          const broken: string[] = [];
          const imgs = Array.from(document.querySelectorAll("img"));
          for (const img of imgs) {
            const src = img.getAttribute("src");
            if (!src) {
              broken.push("Image tag with empty src attribute.");
              continue;
            }
            // Check if naturalWidth is 0 (broken load)
            if (img.complete && img.naturalWidth === 0) {
              broken.push(`Broken image load: ${src}`);
            } else if (!img.complete) {
              // wait briefly
              await new Promise(r => setTimeout(r, 100));
              if (img.naturalWidth === 0) {
                broken.push(`Broken image load: ${src}`);
              }
            }
          }
          return broken;
        });
        pageResult.brokenImages.push(...brokenImages);

        // 4. Test interactivity: click buttons/dropdowns, test validation
        // Let's open modals/dropdowns if present, submit forms if on event create or raise ticket.
        const currentURL = page.url();
        
        if (currentURL.includes("/helpdesk/raise-ticket")) {
          // Fill form partially to test validation
          console.log("Testing Raise Ticket form validation...");
          await page.locator("button[type='submit']").first().click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(500);
          const errorVisible = await page.evaluate(() => {
            return document.body.innerHTML.includes("required") || 
                   document.body.innerHTML.includes("Please select") ||
                   document.body.innerHTML.includes("error") ||
                   document.querySelectorAll("[aria-invalid='true']").length > 0;
          });
          if (!errorVisible) {
            pageResult.uxIssues.push("Raise Ticket form can be submitted empty or does not show clear validation errors immediately.");
          }
        } else if (currentURL.includes("/events/create")) {
          // Test event creation validation
          console.log("Testing Create Event form validation...");
          await page.locator("button[type='submit']").first().click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(500);
          const errorVisible = await page.evaluate(() => {
            return document.body.innerHTML.includes("required") || 
                   document.body.innerHTML.includes("error") ||
                   document.querySelectorAll("[aria-invalid='true']").length > 0;
          });
          if (!errorVisible) {
            pageResult.uxIssues.push("Create Event form allows submission without validation errors showing up.");
          }
        }

        // Test tabs if they exist on the page
        const tabSelectors = ["[role='tab']", ".tab", "[data-tab]", ".tabs button"];
        for (const selector of tabSelectors) {
          const tabs = page.locator(selector);
          const count = await tabs.count();
          if (count > 1) {
            console.log(`Clicking tabs for: ${currentPath}`);
            for (let i = 0; i < Math.min(count, 3); i++) {
              await tabs.nth(i).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(300);
            }
            break;
          }
        }

        // Capture screenshot
        const screenshotFilename = currentPath.replace(/[^a-zA-Z0-9]/g, "_") + ".png";
        const screenshotPath = path.join(screenshotsDir, screenshotFilename);
        await page.screenshot({ path: screenshotPath });
        pageResult.screenshotPath = `/home/zorro-omarchy/.gemini/antigravity-ide/brain/d7b3e431-4ea0-42c5-8d55-2cc688a321c7/audit_screenshots/${screenshotFilename}`;

      } catch (err: any) {
        console.error(`Error auditing ${currentPath}:`, err);
        pageResult.statusCode = 500;
        pageResult.uiBugs.push(`Page failed to load: ${err.message}`);
        pageResult.reproductionSteps += ` Note: The page crashed or timed out during load.`;
      }

      // Collect console events
      pageResult.consoleErrors = [...currentConsoleErrors];
      pageResult.consoleWarnings = [...currentConsoleWarnings];
      pageResult.failedRequests = [...currentFailedRequests];

      // Assess specific UI/UX bugs based on logs and load state
      if (pageResult.statusCode === 404) {
        pageResult.uiBugs.push("Unreachable page (404 Not Found).");
        pageResult.recommendations.push("Verify routing setup, check component registration, or ensure database seeding includes necessary entities.");
      }

      if (pageResult.consoleErrors.length > 0) {
        pageResult.uiBugs.push(`Console errors detected (${pageResult.consoleErrors.length} total).`);
        pageResult.uxIssues.push("JavaScript errors in console may break interactive features for the user.");
        pageResult.recommendations.push("Fix uncaught exceptions and broken api calls listed in console log.");
      }

      if (pageResult.brokenImages.length > 0) {
        pageResult.uiBugs.push(`Broken visual assets found (${pageResult.brokenImages.length} images).`);
        pageResult.recommendations.push("Check that the image paths are correct and referenced files exist in public asset folders.");
      }

      if (pageResult.a11yIssues.length > 0) {
        pageResult.recommendations.push("Fix HTML outline (h1 heading) and add proper aria attributes or labels to fields.");
      }

      // Specific recommendations based on URL patterns
      if (currentPath.includes("/admin/")) {
        pageResult.recommendations.push("Make sure administrative tables have responsive horizontal scroll controls on smaller viewport sizes.");
      }
      if (currentPath.includes("/resources")) {
        pageResult.recommendations.push("Ensure resource download links provide visual spinner states while fetching files.");
      }

      results.push(pageResult);
    }

    // Save crawl results to JSON
    const reportJsonPath = "/home/zorro-omarchy/.gemini/antigravity-ide/brain/d7b3e431-4ea0-42c5-8d55-2cc688a321c7/audit_results.json";
    fs.writeFileSync(reportJsonPath, JSON.stringify(results, null, 2));
    console.log(`Saved audit results to ${reportJsonPath}`);
  });
});
