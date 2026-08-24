function registerSearchRoutes(router, { createHandle, lmsStore }) {
  router.get("/lms/search", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.unifiedSearch(
        {
          query: req.query.query,
          types: req.query.types,
          subjectCode: req.query.subjectCode,
          type: req.query.type,
          difficulty: req.query.difficulty,
          sort: req.query.sort,
          page: req.query.page,
          limit: req.query.limit,
        },
        { userId: req.userContext.userId }
      )
    )
  );
}

module.exports = {
  registerSearchRoutes,
};
