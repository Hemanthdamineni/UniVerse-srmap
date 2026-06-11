const { CREATE_LMS_BASE_SCHEMA_SQL } = require("./baseSchemaSql");
const { ADD_LMS_RESOURCE_MODERATION_AUDIT_SQL } = require("./moderationAuditSql");

const MIGRATIONS = [
  {
    version: 1,
    name: "create_lms_base_schema",
    sql: CREATE_LMS_BASE_SCHEMA_SQL,
  },
  {
    version: 2,
    name: "add_lms_resource_moderation_audit",
    sql: ADD_LMS_RESOURCE_MODERATION_AUDIT_SQL,
  },
];

module.exports = { MIGRATIONS };
