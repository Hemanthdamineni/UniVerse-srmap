const { chromium } = require("playwright");
const { LOGIN_URL, LOGIN_POST_URL } = require("../../config/env");
const { createApiContext } = require("./apiContext");
const {
  extractLoginFieldTargets,
  buildFieldSelector,
  buildLoginPayload,
} = require("./loginForm");

async function submitPayloadInBrowser(page, { username, password, captcha, loginBootstrap }) {
  const payload = buildLoginPayload({
    username,
    password,
    captcha,
    loginBootstrap,
  });
  const formAction = loginBootstrap?.formAction || LOGIN_POST_URL;
  let navigationError = null;
  const navigation = page
    .waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 15000,
    })
    .catch((error) => {
      navigationError = error;
      return null;
    });

  const fields = Object.fromEntries(payload.entries());
  await page.evaluate(
    ({ action, formFields }) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      form.style.display = "none";

      Object.entries(formFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.name = name;
        input.value = String(value ?? "");
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    },
    {
      action: formAction,
      formFields: fields,
    }
  );

  await navigation;
  if (!navigationError) {
    try {
      await page.waitForLoadState("networkidle", { timeout: 10000 });
    } catch {
      // Some ERP pages keep polling; DOM content is sufficient for cookie/bootstrap capture.
    }
  }

  return Array.from(new Set(Object.keys(fields)));
}

async function submitLoginInBrowser({ storageState, loginBootstrap, username, password, captcha }) {
  const browser = await chromium.launch({
    headless: true,
    timeout: 30000,
  });

  const context = await browser.newContext({
    storageState: storageState || undefined,
    viewport: { width: 1366, height: 768 },
    timeout: 30000,
  });

  const page = await context.newPage();

  try {
    const loginHtml = String(loginBootstrap?.loginHtml || "").trim();
    const fieldTargets = extractLoginFieldTargets(loginHtml);
    let submissionMeta = {
      mode: "synthetic_form",
      submittedFieldNames: [],
      visibleFieldIds: [],
      hiddenTargetIds: [],
    };

    if (loginHtml) {
      const loginRouteUrl = LOGIN_URL;
      await page.route(loginRouteUrl, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html; charset=utf-8",
          body: loginHtml,
        });
      });

      await page.goto(loginRouteUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      await page.waitForSelector("#frmSL", { timeout: 10000 });
      const usernameSelector = buildFieldSelector(fieldTargets.username);
      const passwordSelector = buildFieldSelector(fieldTargets.password);
      const captchaSelector = buildFieldSelector(fieldTargets.captcha);
      const canFillVisibleFields = Boolean(usernameSelector && passwordSelector && captchaSelector);

      if (canFillVisibleFields) {
        submissionMeta = {
          mode: "interactive_form",
          submittedFieldNames: [],
          visibleFieldIds: [
            fieldTargets.username?.id || fieldTargets.username?.name || "",
            fieldTargets.password?.id || fieldTargets.password?.name || "",
            fieldTargets.captcha?.id || fieldTargets.captcha?.name || "",
          ].filter(Boolean),
          hiddenTargetIds: [
            loginBootstrap?.credentialAssignments?.username?.targetFieldId,
            loginBootstrap?.credentialAssignments?.password?.targetFieldId,
            ...Object.keys(loginBootstrap?.staticAssignments || {}),
          ].filter(Boolean),
        };
        await page.locator(usernameSelector).first().fill(String(username), { timeout: 3000 });
        await page.locator(passwordSelector).first().fill(String(password), { timeout: 3000 });
        await page.locator(captchaSelector).first().fill(String(captcha), { timeout: 3000 });

        const navigation = page
          .waitForNavigation({
            waitUntil: "domcontentloaded",
            timeout: 15000,
          })
          .catch(() => null);

        if (fieldTargets.hasSubmitButton) {
          await page
            .locator('#frmSL button[type="submit"], #frmSL input[type="submit"], #frmSL button:not([type])')
            .first()
            .click({ timeout: 5000 });
        } else {
          await page.evaluate(() => {
            const form = document.querySelector("#frmSL");
            if (!form) return;
            if (typeof form.requestSubmit === "function") {
              form.requestSubmit();
              return;
            }
            form.submit();
          });
        }

        await navigation;
      } else {
        submissionMeta = {
          mode: "synthetic_form",
          submittedFieldNames: await submitPayloadInBrowser(page, {
            username,
            password,
            captcha,
            loginBootstrap,
          }),
          visibleFieldIds: [],
          hiddenTargetIds: [
            loginBootstrap?.credentialAssignments?.username?.targetFieldId,
            loginBootstrap?.credentialAssignments?.password?.targetFieldId,
            ...Object.keys(loginBootstrap?.staticAssignments || {}),
          ].filter(Boolean),
        };
      }
    } else {
      await page.setContent("<html><body></body></html>", {
        waitUntil: "domcontentloaded",
      });
      submissionMeta = {
        mode: "synthetic_form",
        submittedFieldNames: await submitPayloadInBrowser(page, {
          username,
          password,
          captcha,
          loginBootstrap,
        }),
        visibleFieldIds: [],
        hiddenTargetIds: [
          loginBootstrap?.credentialAssignments?.username?.targetFieldId,
          loginBootstrap?.credentialAssignments?.password?.targetFieldId,
          ...Object.keys(loginBootstrap?.staticAssignments || {}),
        ].filter(Boolean),
      };
    }

    let hasSidebar = false;
    try {
      await page.waitForSelector("#sidebar-menu", { timeout: 12000 });
      hasSidebar = true;
    } catch {
      try {
        await page.waitForLoadState("networkidle", { timeout: 10000 });
      } catch {
        // Some ERP pages keep polling; DOM content is sufficient for cookie/bootstrap capture.
      }
    }

    const html = await page.content();

    return {
      html,
      hasSidebar,
      httpStatus: 200,
      storageState: await context.storageState(),
      finalUrl: page.url(),
      submissionMeta,
    };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

async function submitLoginViaApi({ storageState, loginBootstrap, username, password, captcha }) {
  const payload = buildLoginPayload({
    username,
    password,
    captcha,
    loginBootstrap,
  });

  const submittedFieldNames = Array.from(new Set(Array.from(payload.keys())));
  const api = await createApiContext(storageState, { referer: LOGIN_URL });
  try {
    const response = await api.post(loginBootstrap?.formAction || LOGIN_POST_URL, {
      form: Object.fromEntries(payload.entries()),
      headers: {
        Referer: LOGIN_URL,
      },
    });

    return {
      html: await response.text(),
      hasSidebar: false,
      httpStatus: response.status(),
      storageState: await api.storageState(),
      finalUrl: typeof response.url === "function" ? response.url() : loginBootstrap?.formAction || LOGIN_POST_URL,
      submissionMeta: {
        mode: "api_form",
        submittedFieldNames,
        visibleFieldIds: [
          loginBootstrap?.sourceFieldIds?.username,
          loginBootstrap?.sourceFieldIds?.password,
          loginBootstrap?.captchaFieldName,
        ].filter(Boolean),
        hiddenTargetIds: [
          loginBootstrap?.credentialAssignments?.username?.targetFieldId,
          loginBootstrap?.credentialAssignments?.password?.targetFieldId,
          ...Object.keys(loginBootstrap?.staticAssignments || {}),
        ].filter(Boolean),
      },
    };
  } finally {
    await api.dispose();
  }
}

module.exports = {
  submitPayloadInBrowser,
  submitLoginInBrowser,
  submitLoginViaApi,
};
