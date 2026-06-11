const { LEARNING_MATERIAL_GROUP_LABELS } = require("./constants");
const { toSafeString, toNullableInteger } = require("./utils");

const learningMaterialMethods = {
  getLearningMaterialCatalog({ year } = {}) {
    const normalizedYear = toNullableInteger(year);
    const items = this.listContent({ type: "learning_material" }).filter((item) => {
      const visibility = toSafeString(item.metadata?.visibility).toLowerCase();
      return visibility !== "hidden";
    });
    const years = Array.from(
      new Set(
        items
          .map((item) => Number(item.metadata?.year || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    ).sort((left, right) => left - right);

    const filtered = items.filter((item) => {
      if (!item.metadata || !item.metadata.courseCode || !item.metadata.subjectCode) return false;
      if (normalizedYear !== null && Number(item.metadata.year || 0) !== normalizedYear) return false;
      return true;
    });

    const buckets = filtered.reduce((acc, item) => {
      const metadata = item.metadata || {};
      const key = `${metadata.year || ""}::${metadata.courseCode}`;
      if (!acc.has(key)) {
        acc.set(key, {
          year: Number(metadata.year || 0) || null,
          courseCode: metadata.courseCode,
          courseName: metadata.courseName || metadata.courseCode,
          subjectCodes: new Set(),
          resourceCount: 0,
        });
      }

      const bucket = acc.get(key);
      bucket.subjectCodes.add(metadata.subjectCode);
      bucket.resourceCount += Number(item.resourceCount || 0);
      return acc;
    }, new Map());

    const courses = Array.from(buckets.values())
      .map((bucket) => ({
        year: bucket.year,
        courseCode: bucket.courseCode,
        courseName: bucket.courseName,
        subjectCount: bucket.subjectCodes.size,
        resourceCount: bucket.resourceCount,
      }))
      .sort((left, right) =>
        String(left.courseName || left.courseCode).localeCompare(String(right.courseName || right.courseCode))
      );

    return {
      years,
      selectedYear: normalizedYear,
      courses,
    };
  },

  getLearningMaterialSubjects({ year, courseCode } = {}) {
    const normalizedYear = toNullableInteger(year);
    const normalizedCourseCode = toSafeString(courseCode).toUpperCase();

    if (normalizedYear === null || !normalizedCourseCode) {
      const error = new Error("year and courseCode are required");
      error.status = 400;
      throw error;
    }

    const items = this.listContent({ type: "learning_material" }).filter((item) => {
      const metadata = item.metadata || {};
      const visibility = toSafeString(metadata.visibility).toLowerCase();
      if (visibility === "hidden") return false;
      return Number(metadata.year || 0) === normalizedYear && metadata.courseCode === normalizedCourseCode;
    });

    const buckets = items.reduce((acc, item) => {
      const metadata = item.metadata || {};
      if (!metadata.subjectCode) return acc;
      if (!acc.has(metadata.subjectCode)) {
        acc.set(metadata.subjectCode, {
          subjectCode: metadata.subjectCode,
          subjectName: metadata.subjectName || metadata.subjectCode,
          semester: metadata.semester || null,
          groups: new Set(),
          resourceCount: 0,
        });
      }

      const bucket = acc.get(metadata.subjectCode);
      if (metadata.resourceGroup) bucket.groups.add(metadata.resourceGroup);
      bucket.resourceCount += Number(item.resourceCount || 0);
      return acc;
    }, new Map());

    const subjects = Array.from(buckets.values())
      .map((bucket) => ({
        subjectCode: bucket.subjectCode,
        subjectName: bucket.subjectName,
        semester: bucket.semester,
        groups: Array.from(bucket.groups).sort(),
        resourceCount: bucket.resourceCount,
      }))
      .sort((left, right) => String(left.subjectName).localeCompare(String(right.subjectName)));

    return {
      year: normalizedYear,
      courseCode: normalizedCourseCode,
      subjects,
    };
  },

  getLearningMaterialLibrary({ year, courseCode, subjectCode, query } = {}) {
    const normalizedYear = toNullableInteger(year);
    const normalizedCourseCode = toSafeString(courseCode).toUpperCase();
    const normalizedSubjectCode = toSafeString(subjectCode).toUpperCase();
    const normalizedQuery = toSafeString(query).toLowerCase();

    if (normalizedYear === null || !normalizedCourseCode || !normalizedSubjectCode) {
      const error = new Error("year, courseCode, and subjectCode are required");
      error.status = 400;
      throw error;
    }

    const items = this.listContent({ type: "learning_material" }).filter((item) => {
      const metadata = item.metadata || {};
      const visibility = toSafeString(metadata.visibility).toLowerCase();
      if (visibility === "hidden") return false;
      if (Number(metadata.year || 0) !== normalizedYear) return false;
      if (metadata.courseCode !== normalizedCourseCode) return false;
      if (metadata.subjectCode !== normalizedSubjectCode) return false;
      if (!normalizedQuery) return true;

      const haystack = [
        item.title,
        item.description,
        metadata.subjectName,
        metadata.courseName,
        ...(Array.isArray(metadata.tags) ? metadata.tags : []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    const buckets = items.reduce((acc, item) => {
      const metadata = item.metadata || {};
      const groupKey = metadata.resourceGroup || "links";
      if (!acc.has(groupKey)) {
        acc.set(groupKey, {
          group: groupKey,
          label: LEARNING_MATERIAL_GROUP_LABELS[groupKey] || groupKey,
          items: [],
        });
      }

      acc.get(groupKey).items.push({
        id: item.id,
        title: item.title,
        description: item.description || "",
        metadata,
        resources: this.listResources(item.id),
      });
      return acc;
    }, new Map());

    const groups = Array.from(buckets.values()).sort((left, right) => left.label.localeCompare(right.label));
    const firstItem = items[0] || null;

    return {
      subject: firstItem
        ? {
            year: Number(firstItem.metadata?.year || 0) || normalizedYear,
            courseCode: firstItem.metadata?.courseCode || normalizedCourseCode,
            courseName: firstItem.metadata?.courseName || normalizedCourseCode,
            subjectCode: firstItem.metadata?.subjectCode || normalizedSubjectCode,
            subjectName: firstItem.metadata?.subjectName || normalizedSubjectCode,
            semester: firstItem.metadata?.semester || null,
          }
        : {
            year: normalizedYear,
            courseCode: normalizedCourseCode,
            courseName: normalizedCourseCode,
            subjectCode: normalizedSubjectCode,
            subjectName: normalizedSubjectCode,
            semester: null,
          },
      groups,
      totalItems: items.length,
      totalResources: groups.reduce(
        (sum, group) =>
          sum +
          group.items.reduce(
            (itemSum, item) => itemSum + (Array.isArray(item.resources) ? item.resources.length : 0),
            0
          ),
        0
      ),
    };
  },
};

module.exports = { learningMaterialMethods };
