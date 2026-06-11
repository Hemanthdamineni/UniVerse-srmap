const {
  cleanText,
  makeError,
  normalizeExpectedUrl,
  selectFieldValue,
} = require("./utils");

const payloadBuilderMethods = {
  buildMutationPayload(action, inputPayload) {
    const payload = inputPayload && typeof inputPayload === "object" ? inputPayload : {};
    const defaults = action?.payloadDefaults && typeof action.payloadDefaults === "object"
      ? action.payloadDefaults
      : {};
    const mergedPayload = {
      ...defaults,
      ...payload,
    };

    const endpoint = normalizeExpectedUrl(action?.execution?.url || "");

    if (endpoint === "students/transaction/mobilenumberverificationotp.jsp") {
      const rawMobile = cleanText(
        mergedPayload.optmobilenumber || mergedPayload.mobileNumber || mergedPayload.mobile
      );
      const mobile = rawMobile.replace(/\D/g, "");
      if (!mobile || mobile.length < 10) {
        throw makeError("Valid mobile number is required", 400, "BAD_REQUEST");
      }

      const referencecode =
        cleanText(mergedPayload.referencecode || mergedPayload.referenceCode || "") ||
        String(Number(mobile) * 222);

      return {
        ids: "1",
        optmobilenumber: mobile,
        referencecode,
      };
    }

    if (endpoint === "students/transaction/studentattendanceresources.jsp") {
      const acode = cleanText(
        mergedPayload.acode || mergedPayload.attendanceCode || mergedPayload.code
      ).toUpperCase();
      if (!acode) {
        throw makeError("Attendance code is required", 400, "BAD_REQUEST");
      }

      return {
        ids: cleanText(mergedPayload.ids || "1") || "1",
        acode,
        dynamiclatdata: cleanText(mergedPayload.dynamiclatdata || "0") || "0",
        dynamiclonxdata: cleanText(mergedPayload.dynamiclonxdata || "0") || "0",
      };
    }

    if (endpoint === "students/transaction/studentsonlinepaymentresponse.jsp") {
      const txnid = cleanText(mergedPayload.txnid || mergedPayload.receiptId);
      if (!txnid) {
        throw makeError("Receipt transaction id is required", 400, "BAD_REQUEST");
      }

      return {
        txnid,
        msgs: cleanText(mergedPayload.msgs || mergedPayload.message || ""),
      };
    }

    return mergedPayload;
  },

  buildFormPayload(form, inputPayload) {
    const payload = inputPayload && typeof inputPayload === "object" ? inputPayload : {};
    const nextPayload = {};
    const fields = Array.isArray(form?.fields) ? form.fields : [];

    for (const field of fields) {
      const key = cleanText(field?.name || field?.id);
      if (!key) continue;
      const value = selectFieldValue(field, payload);
      if (value === "") continue;
      nextPayload[key] = value;
    }

    for (const [key, value] of Object.entries(payload)) {
      const normalizedKey = cleanText(key);
      if (!normalizedKey) continue;
      if (value === undefined || value === null) continue;
      nextPayload[normalizedKey] = value;
    }

    return nextPayload;
  },
};

module.exports = { payloadBuilderMethods };
