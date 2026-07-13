const test = require("node:test");
const assert = require("node:assert/strict");

const {
  callEndpointViaApi,
  classifyLoginResponse,
  extractLoginFieldTargets,
  isErpSessionExpiredResponse,
  loginWithCaptcha,
  parseLoginBootstrap,
  buildLoginPayload,
} = require("../src/services/erp/erpClient");

function makeApiResponse(body, status = 200) {
  return {
    async text() {
      return body;
    },
    status() {
      return status;
    },
  };
}

test("detects ERP session expiry from login HTML", () => {
  const loginHtml = `
    <html>
      <body>
        <form id="frmSL" action="StudentLoginToPortal">
          <input id="UserName" />
          <input id="AuthKey" />
          <input id="ccode" name="ccode" />
        </form>
      </body>
    </html>
  `;

  assert.equal(isErpSessionExpiredResponse(loginHtml, null), true);
});

test("shared ERP endpoint fetch throws SESSION_EXPIRED for login HTML", async () => {
  const api = {
    async post() {
      return makeApiResponse(`
        <html>
          <body>
            <div>Login with your Application number and Date of Birth in DDMMYYYY format.</div>
            <form id="frmSL" action="StudentLoginToPortal">
              <input id="UserName" />
              <input id="AuthKey" />
              <input id="ccode" name="ccode" />
            </form>
          </body>
        </html>
      `);
    },
  };

  await assert.rejects(
    () =>
      callEndpointViaApi(
        api,
        {
          method: "POST",
          url: "students/report/studentreportresources.jsp",
          paramsTemplate: { ids: "10" },
        },
        { dropdown: "Academic", subitem: "Time Table" }
      ),
    (error) => {
      assert.equal(error.code, "SESSION_EXPIRED");
      assert.equal(error.status, 401);
      return true;
    }
  );
});

test("shared ERP endpoint fetch throws UNREGISTERED_ERP_PAGE for unknown pages", async () => {
  // Unregistered pages now throw a hard error instead of silently falling back
  // to the generic DOM walker pipeline (which caused silent data loss).
  const api = {
    async post() {
      return makeApiResponse(`
        <html>
          <body>
            <div id="divContent">
              <h2>FEEDBACK</h2>
              <table>
                <tr><th>Day</th><th>Slot</th></tr>
                <tr><td>Monday</td><td>09:00</td></tr>
              </table>
            </div>
          </body>
        </html>
      `);
    },
  };

  await assert.rejects(
    () =>
      callEndpointViaApi(
        api,
        {
          method: "POST",
          url: "students/report/studentreportresources.jsp",
          paramsTemplate: { ids: "10" },
        },
        { dropdown: "Academic", subitem: "Timetable Feedback" }
      ),
    (error) => {
      assert.equal(error.code, "UNREGISTERED_ERP_PAGE");
      assert.equal(error.status, 500);
      return true;
    }
  );
});

test("calling without menuItem throws UNREGISTERED_ERP_PAGE", async () => {
  // The generic DOM walker fallback has been removed.
  // All real callers supply a registered dropdown/subitem.
  // Passing null menuItem is now a hard error by design.
  const api = {
    async post() {
      return makeApiResponse(`<html><body><div id="divContent"><h2>SOME DATA</h2></div></body></html>`);
    },
  };

  await assert.rejects(
    () =>
      callEndpointViaApi(
        api,
        {
          method: "POST",
          url: "students/report/studentreportresources.jsp",
          paramsTemplate: { ids: "10" },
        },
        null
      ),
    (error) => {
      assert.equal(error.code, "UNREGISTERED_ERP_PAGE");
      assert.equal(error.status, 500);
      return true;
    }
  );
});

test("targeted extractor is used for registered pages", async () => {
  // Timetable page now hits the targeted extractor and returns _extracted
  const api = {
    async post() {
      return makeApiResponse(`
        <html>
          <body>
            <h2>TIME TABLE</h2>
            <table id="tblClassTimetable">
              <tr class="timetablehead"><td>&nbsp;</td></tr>
              <tr class="subheader"><td>&nbsp;</td><td>09:00 To 09:50</td></tr>
              <tr>
                <td class="subheader">Monday</td>
                <td class="timetabledetails" title="AUTOMATA">CSE 304(C 705)</td>
              </tr>
            </table>
            <table id="tblSubjectList">
              <tr>
                <td class="subheader">Code</td>
                <td class="subheader">Description</td>
                <td class="subheader">L-T-P-C</td>
                <td class="subheader">Faculty</td>
                <td class="subheader">Room</td>
              </tr>
            </table>
          </body>
        </html>
      `);
    },
  };

  const result = await callEndpointViaApi(
    api,
    {
      method: "POST",
      url: "students/report/studentreportresources.jsp",
      paramsTemplate: { ids: "10" },
    },
    { dropdown: "Academic", subitem: "Time Table" }
  );

  // Targeted extractor embeds typed data in _extracted
  assert.ok(result._extracted, "targeted extractor should populate _extracted");
  assert.equal(result._extracted.type, "timetable");
  assert.equal(result.meta?.usedTargetedExtractor, true);
  assert.equal(Array.isArray(result.tables), true);
});

test("extractLoginFieldTargets resolves legacy login inputs", () => {
  const fields = extractLoginFieldTargets(`
    <html>
      <body>
        <form id="frmSL" action="StudentLoginToPortal">
          <input id="UserName" />
          <input id="AuthKey" type="password" />
          <input id="ccode" name="ccode" />
          <button type="submit">Login</button>
        </form>
      </body>
    </html>
  `);

  assert.equal(fields.username?.id, "UserName");
  assert.equal(fields.password?.id, "AuthKey");
  assert.equal(fields.captcha?.id, "ccode");
  assert.equal(fields.hasSubmitButton, true);
});

test("extractLoginFieldTargets supports payload-style login inputs", () => {
  const fields = extractLoginFieldTargets(`
    <html>
      <body>
        <form id="frmSL" action="StudentLoginToPortal">
          <input name="txtUserName" placeholder="Application Number" />
          <input name="txtAuthKey" type="password" />
          <input name="ccode" placeholder="Captcha" />
        </form>
      </body>
    </html>
  `);

  assert.equal(fields.username?.name, "txtUserName");
  assert.equal(fields.password?.name, "txtAuthKey");
  assert.equal(fields.captcha?.name, "ccode");
  assert.equal(fields.hasSubmitButton, false);
});

test("buildLoginPayload preserves obfuscated ERP login assignments", () => {
  const loginBootstrap = parseLoginBootstrap(`
    <html>
      <body>
        <form id="frmSL" action="/srmapstudentcorner/StudentLoginToPortal">
          <input id="4a253eb416dc92ff962c44b0075b69cd" name="userInput" patterns=".*" />
          <input id="864aea631e37e46d31892030ab5f3d6f" name="passInput" type="password" />
          <input id="31f5dc857dafad74193c137b9a93b1bf" name="encodedUser" type="hidden" value="" />
          <input id="76963c0c93ef83d3cfcc9e88b0016882" name="encodedPass" type="hidden" value="" />
          <input id="f90e8b4deef6bcfe0f0e8b0baeca198c" name="seedValue" type="hidden" value="" />
          <input id="ccode" name="ccode" />
        </form>
        <img src="/srmapstudentcorner/stuportal/captcha?token=123" />
        <script>
          $("#" + "31f5dc857dafad74193c137b9a93b1bf").val("prefix-user-" + $("#" + "4a253eb416dc92ff962c44b0075b69cd").val() + "-suffix-user");
          $("#" + "76963c0c93ef83d3cfcc9e88b0016882").val("prefix-pass-" + $("#" + "864aea631e37e46d31892030ab5f3d6f").val() + "-suffix-pass");
          $("#" + "f90e8b4deef6bcfe0f0e8b0baeca198c").val('static-seed');
          $("#" + "864aea631e37e46d31892030ab5f3d6f").val(".......");
        </script>
      </body>
    </html>
  `);

  const payload = buildLoginPayload({
    username: "AP12345678901",
    password: "secret123",
    captcha: "ab12cd",
    loginBootstrap,
  });

  assert.equal(payload.get("encodedUser"), "prefix-user-AP12345678901-suffix-user");
  assert.equal(payload.get("encodedPass"), "prefix-pass-secret123-suffix-pass");
  assert.equal(payload.get("seedValue"), "static-seed");
  assert.equal(payload.get("userInput"), "AP12345678901");
  assert.equal(payload.get("passInput"), "secret123");
  assert.equal(payload.get("ccode"), "ab12cd");
});

test("classifyLoginResponse detects invalid captcha and authenticated shell states", () => {
  const invalidCaptcha = classifyLoginResponse("<div>Invalid captcha</div>");
  assert.equal(invalidCaptcha.classifier, "invalid_captcha");
  assert.equal(invalidCaptcha.failureCode, "INVALID_CAPTCHA");

  const authenticated = classifyLoginResponse('<div id="sidebar-menu">Welcome</div>', {
    finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/HRDsystem",
  });
  assert.equal(authenticated.classifier, "authenticated_shell");
  assert.equal(authenticated.authenticated, true);
});

test("classifyLoginResponse does not treat 404 verification pages as authenticated", () => {
  const classified = classifyLoginResponse("<html><body>Not Found</body></html>", {
    finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/HRDsystem",
    httpStatus: 404,
  });

  assert.equal(classified.classifier, "unknown_upstream_state");
  assert.equal(classified.authenticated, false);
});

test("loginWithCaptcha succeeds with deferred profile when auth shell is verified", async () => {
  const result = await loginWithCaptcha(
    {
      storageState: { cookies: [] },
      username: "student",
      password: "secret",
      captcha: "abc123",
      loginBootstrap: { formAction: "StudentLoginToPortal" },
      preAuthAttempt: {
        loginAttemptId: "attempt-1",
        issuedAt: Date.now(),
      },
    },
    {
      traceFactory: () => ({
        recordStage() {},
        finish() {},
      }),
      submitLoginViaApiFn: async () => ({
        html: "<html><body>OK</body></html>",
        hasSidebar: false,
        httpStatus: 200,
        storageState: { cookies: [{ name: "JSESSIONID" }] },
        finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/StudentLoginToPortal",
      }),
      verifyAuthenticatedShellFn: async () => ({
        classifier: "authenticated_shell",
        authenticated: true,
        httpStatus: 200,
        html: '<div id="sidebar-menu">Shell</div>',
        finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/HRDsystem",
        storageState: { cookies: [{ name: "JSESSIONID" }] },
      }),
      probeProfileFn: async () => ({
        classifier: "profile_probe_login_page",
        profileStatus: "deferred",
        valid: false,
        storageState: { cookies: [{ name: "JSESSIONID" }] },
        finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/HRDsystem",
      }),
    }
  );

  assert.equal(result.success, true);
  assert.equal(result.profileStatus, "deferred");
  assert.equal(result.profileData, undefined);
});

test("loginWithCaptcha returns invalid credentials without browser fallback", async () => {
  const result = await loginWithCaptcha(
    {
      storageState: { cookies: [] },
      username: "student",
      password: "wrong",
      captcha: "abc123",
      loginBootstrap: { formAction: "StudentLoginToPortal" },
      preAuthAttempt: {
        loginAttemptId: "attempt-2",
        issuedAt: Date.now(),
      },
    },
    {
      traceFactory: () => ({
        recordStage() {},
        finish() {},
      }),
      submitLoginViaApiFn: async () => ({
        html: "<html><body>Invalid login</body></html>",
        hasSidebar: false,
        httpStatus: 200,
        storageState: { cookies: [] },
        finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/StudentLoginToPortal",
      }),
      submitLoginInBrowserFn: async () => {
        throw new Error("browser fallback should not run");
      },
    }
  );

  assert.equal(result.success, false);
  assert.equal(result.failureCode, "INVALID_CREDENTIALS");
  assert.equal(result.status, 401);
});

test("loginWithCaptcha rejects expired captcha sessions before upstream submit", async () => {
  await assert.rejects(
    () =>
      loginWithCaptcha(
        {
          storageState: { cookies: [] },
          username: "student",
          password: "secret",
          captcha: "abc123",
          loginBootstrap: { formAction: "StudentLoginToPortal" },
          preAuthAttempt: {
            loginAttemptId: "attempt-3",
            issuedAt: Date.now() - 20_000,
          },
        },
        {
          nowFn: () => Date.now(),
        }
      ),
    (error) => {
      assert.equal(error.code, "CAPTCHA_EXPIRED");
      assert.equal(error.status, 401);
      return true;
    }
  );
});

test("loginWithCaptcha surfaces LOGIN_VERIFICATION_FAILED for ambiguous upstream states", async () => {
  await assert.rejects(
    () =>
      loginWithCaptcha(
        {
          storageState: { cookies: [] },
          username: "student",
          password: "secret",
          captcha: "abc123",
          loginBootstrap: { formAction: "StudentLoginToPortal" },
          preAuthAttempt: {
            loginAttemptId: "attempt-4",
            issuedAt: Date.now(),
          },
        },
        {
          traceFactory: () => ({
            recordStage() {},
            finish() {},
          }),
          submitLoginViaApiFn: async () => ({
            html: "<html><body>Maybe</body></html>",
            hasSidebar: false,
            httpStatus: 200,
            storageState: { cookies: [] },
            finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/StudentLoginToPortal",
          }),
          verifyAuthenticatedShellFn: async () => ({
            classifier: "unknown_upstream_state",
            authenticated: false,
            httpStatus: 200,
            html: "<html><body>Still unknown</body></html>",
            finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/HRDsystem",
            storageState: { cookies: [] },
          }),
          submitLoginInBrowserFn: async () => ({
            html: "<html><body>Maybe</body></html>",
            hasSidebar: false,
            httpStatus: 200,
            storageState: { cookies: [] },
            finalUrl: "https://student.srmap.edu.in/srmapstudentcorner/StudentLoginToPortal",
          }),
        }
      ),
    (error) => {
      assert.equal(error.code, "LOGIN_VERIFICATION_FAILED");
      assert.equal(error.status, 502);
      return true;
    }
  );
});
