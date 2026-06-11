const { resolveSessionId } = require("../../utils/cookies");

function registerResourceRoutes(
  router,
  {
    createHandle,
    lmsStore,
    duplicateDetector,
    readingTimeEstimator,
    interactionTracker,
    examFeedbackService,
    upload,
    uploadLimiter,
    commentLimiter,
    requestLimiter,
    ensureAdmin,
    parseResourcePayload,
    persistUploadedFile,
    toBoolean,
  }
) {
  router.get("/lms/resources", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getResources(
        {
          subjectCode: req.query.subjectCode,
          semester: req.query.semester,
          unit: req.query.unit,
          type: req.query.type,
          difficulty: req.query.difficulty,
          tags: req.query.tags,
          examYear: req.query.examYear,
          examType: req.query.examType,
          examProven: toBoolean(req.query.examProven),
          query: req.query.query,
          sort: req.query.sort,
          page: req.query.page,
          limit: req.query.limit,
        },
        { userId: req.userContext.userId }
      )
    )
  );

  router.get("/lms/resources/check-duplicate", (req, res, next) =>
    createHandle(req, res, next, async () =>
      duplicateDetector.checkDuplicate({
        fileHash: req.query.fileHash,
        title: req.query.title,
        subjectCode: req.query.subjectCode,
      })
    )
  );

  router.get("/lms/resources/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getResource(req.params.id, req.userContext.userId, {
        includeHiddenOwn: true,
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/resources", uploadLimiter, upload.single("file"), (req, res, next) =>
    createHandle(req, res, next, async () => {
      const payload = parseResourcePayload(req);
      let filePath = null;
      let fileHash = null;
      let fileSize = null;
      let mimeType = null;

      if (req.file) {
        fileHash = duplicateDetector.computeHash(req.file.buffer);
        const duplicate = await duplicateDetector.checkDuplicate({
          fileHash,
          title: payload.title,
          subjectCode: payload.subjectCode,
        });
        if (duplicate.exact) {
          const error = new Error("An identical file already exists for this subject.");
          error.status = 409;
          error.code = "LMS_DUPLICATE";
          throw error;
        }
        filePath = await persistUploadedFile(req.file, payload.subjectCode, payload.type || "file");
        fileSize = req.file.size;
        mimeType = req.file.mimetype;
      }

      const estimatedMinutes = await readingTimeEstimator.computeReadingTime({
        type: payload.type,
        noteContent: payload.noteContent,
        structuredContent: payload.structuredContent,
        filePath,
        fileSize,
        mimeType,
        url: payload.url,
      });

      return lmsStore.createResource(req.userContext.userId, {
        ...payload,
        filePath,
        fileHash,
        fileSize,
        mimeType,
        estimatedMinutes,
      });
    })
  );

  router.put("/lms/resources/:id", uploadLimiter, upload.single("file"), (req, res, next) =>
    createHandle(req, res, next, async () => {
      const payload = parseResourcePayload(req);
      let filePath = payload.filePath;
      let fileHash = payload.fileHash;
      let fileSize = payload.fileSize;
      let mimeType = payload.mimeType;

      if (req.file) {
        fileHash = duplicateDetector.computeHash(req.file.buffer);
        const duplicate = await duplicateDetector.checkDuplicate({
          fileHash,
          title: payload.title,
          subjectCode: payload.subjectCode,
          excludeId: req.params.id,
        });
        if (duplicate.exact) {
          const error = new Error("An identical file already exists for this subject.");
          error.status = 409;
          error.code = "LMS_DUPLICATE";
          throw error;
        }
        filePath = await persistUploadedFile(req.file, payload.subjectCode, payload.type || "file");
        fileSize = req.file.size;
        mimeType = req.file.mimetype;
      }

      const estimatedMinutes = await readingTimeEstimator.computeReadingTime({
        type: payload.type,
        noteContent: payload.noteContent,
        structuredContent: payload.structuredContent,
        filePath,
        fileSize,
        mimeType,
        url: payload.url,
      });

      return lmsStore.updateResource(req.params.id, req.userContext.userId, {
        ...payload,
        filePath,
        fileHash,
        fileSize,
        mimeType,
        estimatedMinutes,
      }, {
        isAdmin: req.userContext.hasAdminAccess,
      });
    })
  );

  router.delete("/lms/resources/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteResource(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/resources/:id/restore", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.restoreResource(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.post("/lms/resources/bulk", ensureAdmin, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.bulkResourceOperation(
        req.userContext.userId,
        req.body.operation,
        req.body.resourceIds,
        req.body.payload,
        { isAdmin: true }
      )
    )
  );

  router.post("/lms/resources/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.toggleUpvote(req.params.id, req.userContext.userId))
  );

  router.post("/lms/resources/:id/bookmark", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.toggleBookmark(req.params.id, req.userContext.userId))
  );

  router.post("/lms/resources/:id/flag", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.flagResource(req.params.id, req.userContext.userId, req.body.reason)
    )
  );

  router.post("/lms/resources/:id/mark-outdated", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.markOutdated(req.params.id, req.userContext.userId, req.body.reason)
    )
  );

  router.post("/lms/resources/:id/rate", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.rateResource(
        req.params.id,
        req.userContext.userId,
        req.body.rating,
        req.body.review,
        req.body.dimensionTags
      )
    )
  );

  router.post("/lms/resources/:id/view", (req, res, next) =>
    createHandle(req, res, next, async () =>
      interactionTracker.track({
        userId: req.userContext.userId,
        resourceId: req.params.id,
        action: "view",
        timeSpentMs: req.body.timeSpentMs,
        metadata: req.body.metadata,
      })
    )
  );

  router.get("/lms/resources/:id/comments", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.listComments(req.params.id, req.userContext.userId))
  );

  router.post("/lms/resources/:id/comments", commentLimiter, (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.commentOnResource(req.params.id, req.userContext.userId, req.body.content)
    )
  );

  router.post("/lms/comments/:id/helpful", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.toggleCommentHelpful(req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/resources/:id/annotations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getAnnotations(req.userContext.userId, req.params.id)
    )
  );

  router.post("/lms/resources/:id/annotations", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.saveAnnotation(req.userContext.userId, req.params.id, req.body.content)
    )
  );

  router.delete("/lms/annotations/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.deleteAnnotation(req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/pyq/upcoming", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.getUpcomingExamPyqs(req.userContext.userId))
  );

  router.get("/lms/pyq/:subjectCode", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getPyqBank(
        req.params.subjectCode,
        {
          examYear: req.query.examYear,
          examType: req.query.examType,
          page: req.query.page,
          limit: req.query.limit,
          sort: req.query.sort || "recent",
        },
        { userId: req.userContext.userId }
      )
    )
  );

  router.get("/lms/requests", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getRequests({
        subjectCode: req.query.subjectCode,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit,
      })
    )
  );

  router.post("/lms/requests", requestLimiter, (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.createRequest(req.userContext.userId, req.body))
  );

  router.post("/lms/requests/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.upvoteRequest(req.params.id, req.userContext.userId))
  );

  router.post("/lms/requests/:id/fulfill", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.fulfillRequest(req.params.id, req.userContext.userId, req.body.resourceId)
    )
  );

  router.delete("/lms/requests/:id", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.closeRequest(req.params.id, req.userContext.userId, {
        isAdmin: req.userContext.hasAdminAccess,
      })
    )
  );

  router.get("/lms/exam-feedback/pending", (req, res, next) =>
    createHandle(req, res, next, async () =>
      examFeedbackService.getPendingFeedback({
        userId: req.userContext.userId,
        sessionId: resolveSessionId(req),
      })
    )
  );

  router.post("/lms/exam-feedback", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.submitExamFeedback(req.userContext.userId, req.body.feedbackItems)
    )
  );

  router.post("/lms/resources/:id/quiz-attempt", (req, res, next) =>
    createHandle(req, res, next, async () => {
      const result = lmsStore.recordQuizAttempt(req.params.id, req.userContext.userId, req.body);
      await interactionTracker.track({
        userId: req.userContext.userId,
        resourceId: req.params.id,
        action: Number(result.percentage || 0) >= 60 ? "quiz_pass" : "quiz_fail",
        timeSpentMs: req.body.timeTakenMs,
        metadata: { percentage: result.percentage },
      });
      return result;
    })
  );

  router.get("/lms/resources/:id/quiz-attempts", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getQuizAttempts(req.params.id, req.userContext.userId)
    )
  );

  router.get("/lms/question-bank", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.getQuestionBank(req.query.subjectCode, {
        unit: req.query.unit,
        difficulty: req.query.difficulty,
        page: req.query.page,
        limit: req.query.limit,
      })
    )
  );

  router.post("/lms/question-bank", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.addQuestion(req.userContext.userId, req.body)
    )
  );

  router.post("/lms/question-bank/:id/upvote", (req, res, next) =>
    createHandle(req, res, next, async () => lmsStore.upvoteQuestion(req.params.id))
  );

  router.get("/lms/question-bank/build-quiz", (req, res, next) =>
    createHandle(req, res, next, async () =>
      lmsStore.buildQuizFromBank(
        req.query.subjectCode,
        req.query.unit,
        req.query.count,
        req.query.difficulty
      )
    )
  );
}

module.exports = { registerResourceRoutes };
